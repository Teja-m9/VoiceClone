from app.api.schemas.voice_profiles import (
    CreateVoiceProfileRequest,
    TrainVoiceResponse,
    VoiceProfileResponse,
)
from app.api.services import voice_profile_service
from app.client.runpod_client import RunpodClient
from app.client.s3_client import S3Client
from app.client.supabase_client import SupabaseClient


async def create(
    supabase: SupabaseClient,
    s3: S3Client,
    user_id: str,
    payload: CreateVoiceProfileRequest,
) -> VoiceProfileResponse:
    return await voice_profile_service.create_voice_profile(supabase, s3, user_id, payload)


async def train(
    supabase: SupabaseClient,
    s3: S3Client,
    runpod: RunpodClient,
    user_id: str,
    email: str | None,
    voice_id: str,
) -> TrainVoiceResponse:
    return await voice_profile_service.start_training(
        supabase=supabase, s3=s3, runpod=runpod, user_id=user_id, email=email, voice_id=voice_id
    )
