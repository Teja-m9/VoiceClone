from fastapi import APIRouter, Depends, Header, Request

from app.api.controllers import billing_controller, webhook_controller
from app.api.deps import get_stripe, get_supabase
from app.api.schemas.webhooks import RunpodWebhook
from app.client.stripe_client import StripeClient
from app.client.supabase_client import SupabaseClient

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/runpod")
async def runpod_webhook(
    request: Request,
    token: str = "",
    supabase: SupabaseClient = Depends(get_supabase),
) -> dict[str, str]:
    # `token` is the ?token= query param authenticating the callback.
    raw = await request.body()
    hook = RunpodWebhook.model_validate_json(raw)
    await webhook_controller.handle_runpod(supabase, token, hook)
    return {"status": "ok"}


@router.post("/stripe")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(default="", alias="Stripe-Signature"),
    supabase: SupabaseClient = Depends(get_supabase),
    stripe: StripeClient = Depends(get_stripe),
) -> dict[str, str]:
    raw = await request.body()
    await billing_controller.handle_stripe_webhook(supabase, stripe, raw, stripe_signature)
    return {"status": "ok"}
