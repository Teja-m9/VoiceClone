"""Stripe client — hosted Checkout session creation + webhook signature verification.
Stripe's SDK is sync, so network calls are wrapped in run_in_threadpool."""
from functools import lru_cache
from typing import Any

import stripe
from fastapi.concurrency import run_in_threadpool

from config import config


class StripeClient:
    def __init__(self) -> None:
        stripe.api_key = config.stripe_secret_key

    async def create_checkout_session(
        self, *, price_id: str, success_url: str, cancel_url: str, metadata: dict[str, str]
    ) -> str:
        def _create() -> str:
            session = stripe.checkout.Session.create(
                mode="subscription",
                line_items=[{"price": price_id, "quantity": 1}],
                success_url=success_url,
                cancel_url=cancel_url,
                metadata=metadata,
                subscription_data={"metadata": metadata},
            )
            return session.url or ""

        return await run_in_threadpool(_create)

    def construct_event(self, payload: bytes, signature: str) -> dict[str, Any]:
        """Verify the Stripe webhook signature and return the event (raises on bad sig)."""
        return stripe.Webhook.construct_event(payload, signature, config.stripe_webhook_secret)


@lru_cache(maxsize=1)
def get_stripe() -> StripeClient:
    return StripeClient()
