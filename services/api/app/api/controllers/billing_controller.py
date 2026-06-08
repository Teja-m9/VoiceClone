from app.api.schemas.billing import CheckoutRequest, CheckoutResponse
from app.api.services import billing_service
from app.client.stripe_client import StripeClient
from app.client.supabase_client import SupabaseClient


async def create_checkout(stripe: StripeClient, user_id: str, payload: CheckoutRequest) -> CheckoutResponse:
    url = await billing_service.create_checkout(stripe=stripe, user_id=user_id, plan=payload.plan)
    return CheckoutResponse(url=url)


async def handle_stripe_webhook(
    supabase: SupabaseClient, stripe: StripeClient, raw_body: bytes, signature: str
) -> None:
    await billing_service.handle_webhook(supabase, stripe, raw_body, signature)
