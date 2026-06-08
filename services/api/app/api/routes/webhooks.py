from fastapi import APIRouter, Depends, Request

from app.api.controllers import webhook_controller
from app.api.deps import get_supabase
from app.api.schemas.webhooks import RunpodWebhook
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
