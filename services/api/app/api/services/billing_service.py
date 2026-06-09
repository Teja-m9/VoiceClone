"""Stripe billing: create a Checkout session and finalize subscription state from webhooks.
The subscriptions row drives profiles.plan via the sync_profile_plan DB trigger."""
from datetime import datetime, timezone
from typing import Any

from app.client.stripe_client import StripeClient
from app.client.supabase_client import SupabaseClient
from app.errors import UpstreamError, WebhookSignatureError
from app.utils.logging_config import get_logger
from config import config

log = get_logger("billing_service")

_PRICE = {"monthly": lambda: config.stripe_price_monthly, "quarterly": lambda: config.stripe_price_quarterly}


def _quota_for_plan(plan: str) -> int:
    """Songs granted per billing period for a plan name."""
    return {
        "monthly": config.premium_monthly_quota,
        "quarterly": config.premium_quarterly_quota,
    }.get(plan, 0)


def _map_status(stripe_status: str) -> str:
    """Map Stripe subscription status → our sub_status_t enum."""
    if stripe_status in ("active", "trialing"):
        return "active"
    if stripe_status in ("canceled", "incomplete_expired"):
        return "cancelled"
    if stripe_status == "past_due" or stripe_status == "unpaid":
        return "halted"
    return "created"


async def create_checkout(*, stripe: StripeClient, user_id: str, plan: str) -> str:
    price_id = _PRICE[plan]()
    if not config.stripe_secret_key or not price_id:
        raise UpstreamError("Billing is not configured on the server")
    return await stripe.create_checkout_session(
        price_id=price_id,
        success_url=config.billing_success_url,
        cancel_url=config.billing_cancel_url,
        metadata={"user_id": user_id, "plan": plan},
    )


async def _upsert_subscription(
    supabase: SupabaseClient,
    *,
    user_id: str,
    stripe_subscription_id: str,
    stripe_customer_id: str | None,
    status: str,
    current_period_end: str | None,
) -> None:
    existing = await supabase.select_one("subscriptions", {"stripe_subscription_id": stripe_subscription_id})
    patch: dict[str, Any] = {
        "stripe_subscription_id": stripe_subscription_id,
        "stripe_customer_id": stripe_customer_id,
        "status": status,
        "current_period_end": current_period_end,
    }
    # Only set user_id when we actually have it (don't clobber on a metadata-less update).
    if user_id:
        patch["user_id"] = user_id

    if existing:
        await supabase.update("subscriptions", {"stripe_subscription_id": stripe_subscription_id}, patch)
    elif user_id:
        await supabase.insert("subscriptions", patch)


async def handle_webhook(supabase: SupabaseClient, stripe: StripeClient, payload: bytes, signature: str) -> None:
    try:
        event = stripe.construct_event(payload, signature)
    except Exception as exc:  # noqa: BLE001 — any verification failure is a bad signature
        raise WebhookSignatureError("Invalid Stripe webhook signature") from exc

    etype: str = event["type"]
    obj: dict[str, Any] = event["data"]["object"]

    if etype == "checkout.session.completed":
        meta = obj.get("metadata") or {}
        user_id = meta.get("user_id")
        sub_id = obj.get("subscription")
        if user_id and sub_id:
            await _upsert_subscription(
                supabase,
                user_id=user_id,
                stripe_subscription_id=sub_id,
                stripe_customer_id=obj.get("customer"),
                status="active",
                current_period_end=None,
            )
            # Grant the plan's song allowance for this period and reset usage.
            await supabase.update(
                "profiles",
                {"id": user_id},
                {"plan_quota": _quota_for_plan(meta.get("plan", "")), "plan_used": 0},
            )
            log.info("checkout completed user_id=%s sub=%s", user_id, sub_id)

    elif etype == "invoice.payment_succeeded":
        # Renewal → refill the period allowance (reset usage to 0).
        if obj.get("billing_reason") == "subscription_cycle":
            sub_id = obj.get("subscription")
            sub = await supabase.select_one("subscriptions", {"stripe_subscription_id": sub_id}) if sub_id else None
            if sub and sub.get("user_id"):
                await supabase.update("profiles", {"id": sub["user_id"]}, {"plan_used": 0})
                log.info("renewal refilled allowance user_id=%s sub=%s", sub["user_id"], sub_id)

    elif etype in ("customer.subscription.updated", "customer.subscription.deleted"):
        user_id = (obj.get("metadata") or {}).get("user_id")
        period_end = obj.get("current_period_end")
        await _upsert_subscription(
            supabase,
            user_id=user_id or "",
            stripe_subscription_id=obj["id"],
            stripe_customer_id=obj.get("customer"),
            status=_map_status(obj.get("status", "")),
            current_period_end=(
                datetime.fromtimestamp(period_end, tz=timezone.utc).isoformat() if period_end else None
            ),
        )
