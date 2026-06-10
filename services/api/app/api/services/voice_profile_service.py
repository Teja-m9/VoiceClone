"""Register a cloned-voice reference after its audio has landed in S3, and kick off Pro
Voice fine-tuning (see docs/PRO_VOICE.md)."""
from app.api.schemas.voice_profiles import (
    CreateVoiceProfileRequest,
    TrainVoiceResponse,
    VoiceProfileResponse,
)
from app.client.runpod_client import RunpodClient
from app.client.s3_client import S3Client
from app.client.supabase_client import SupabaseClient
from app.constants.admins import is_admin_email
from app.constants.enums import VoiceStatus
from app.errors import ForbiddenError, NotFoundError, UploadNotFoundError, UpstreamError
from app.helpers.keys import belongs_to_user, voice_model_key
from app.helpers.payloads import build_train_job_payload
from app.utils.logging_config import get_logger
from config import config

log = get_logger("voice_profile_service")


async def create_voice_profile(
    supabase: SupabaseClient,
    s3: S3Client,
    user_id: str,
    req: CreateVoiceProfileRequest,
) -> VoiceProfileResponse:
    # Guard against cross-tenant key injection.
    if not belongs_to_user(req.ref_audio_key, user_id, prefix="voice_ref"):
        raise ForbiddenError("Reference key does not belong to this user")
    # Confirm the upload actually landed in S3 before recording it.
    if not await s3.exists(req.ref_audio_key):
        raise UploadNotFoundError("Uploaded audio not found in storage")

    row = await supabase.insert(
        "voice_profiles",
        {
            "user_id": user_id,
            "name": req.name,
            "status": VoiceStatus.READY.value,  # zero-shot: ready immediately
            "ref_audio_key": req.ref_audio_key,
            "duration_ms": req.duration_ms,
        },
    )
    return VoiceProfileResponse(
        id=row["id"],
        name=row["name"],
        status=row["status"],
        ref_audio_key=row["ref_audio_key"],
        duration_ms=row.get("duration_ms"),
        created_at=row["created_at"],
    )


async def start_training(
    *,
    supabase: SupabaseClient,
    s3: S3Client,
    runpod: RunpodClient,
    user_id: str,
    email: str | None,
    voice_id: str,
) -> TrainVoiceResponse:
    """Kick off a Pro Voice fine-tune for the user's voice (premium-gated; admins bypass).
    Sets training_status='training' and triggers the GPU worker in train mode."""
    vp = await supabase.select_one("voice_profiles", {"id": voice_id})
    if not vp or vp["user_id"] != user_id:
        raise NotFoundError("Voice profile not found")

    # Premium gate (admins always allowed).
    if not is_admin_email(email):
        prof = await supabase.select_one("profiles", {"id": user_id})
        if (prof or {}).get("plan") != "premium":
            raise ForbiddenError("Pro Voice is a premium feature")

    # Already training → no-op (idempotent).
    if vp.get("training_status") != "training":
        await supabase.update("voice_profiles", {"id": voice_id}, {"training_status": "training"})
        voice_url = await supabase.create_signed_url("voices", vp["ref_audio_key"], config.presign_get_ttl)
        if not voice_url:
            raise UpstreamError("Could not sign the voice reference")
        mkey = voice_model_key(user_id, voice_id)
        payload = build_train_job_payload(
            voice_id=voice_id,
            voice_ref_get_url=voice_url,
            model_put_url=s3.presign_put(mkey, "application/octet-stream", config.presign_get_ttl),
            model_key=mkey,
        )
        webhook_url = f"{config.api_base_url}/webhooks/runpod?token={config.runpod_webhook_secret}"
        await runpod.trigger(payload, webhook_url)
        log.info("pro voice training started voice=%s user=%s", voice_id, user_id)

    return TrainVoiceResponse(id=voice_id, tier=vp.get("tier", "zero_shot"), training_status="training")
