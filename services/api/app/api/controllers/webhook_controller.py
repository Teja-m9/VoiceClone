import hmac

from app.api.schemas.webhooks import RunpodWebhook
from app.api.services import job_service
from app.client.supabase_client import SupabaseClient
from app.errors import WebhookSignatureError
from config import config


async def handle_runpod(supabase: SupabaseClient, token: str, hook: RunpodWebhook) -> None:
    """Authenticate the callback via the secret token embedded in the webhook URL
    (Runpod doesn't HMAC-sign webhooks), then apply the terminal transition."""
    if not hmac.compare_digest(token or "", config.runpod_webhook_secret):
        raise WebhookSignatureError("Invalid webhook token")
    # Pro Voice training callbacks carry mode="train"; everything else is a cover job.
    if (hook.output or {}).get("mode") == "train":
        await job_service.complete_training_from_webhook(supabase, hook)
    else:
        await job_service.complete_from_webhook(supabase, hook)
