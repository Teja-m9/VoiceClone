from app.api.schemas.voice_profiles import CreateVoiceProfileRequest, VoiceProfileResponse
from app.api.services import voice_profile_service
from app.client.s3_client import S3Client
from app.client.supabase_client import SupabaseClient


async def create(
    supabase: SupabaseClient,
    s3: S3Client,
    user_id: str,
    payload: CreateVoiceProfileRequest,
) -> VoiceProfileResponse:
    return await voice_profile_service.create_voice_profile(supabase, s3, user_id, payload)
