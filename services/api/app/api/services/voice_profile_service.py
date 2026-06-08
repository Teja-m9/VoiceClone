"""Register a cloned-voice reference after its audio has landed in S3."""
from app.api.schemas.voice_profiles import CreateVoiceProfileRequest, VoiceProfileResponse
from app.client.s3_client import S3Client
from app.client.supabase_client import SupabaseClient
from app.constants.enums import VoiceStatus
from app.errors import ForbiddenError, UploadNotFoundError
from app.helpers.keys import belongs_to_user


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
