from fastapi import APIRouter, Depends

from app.api.controllers import voice_profile_controller
from app.api.deps import Principal, current_principal, get_runpod, get_s3, get_supabase
from app.api.schemas.voice_profiles import (
    CreateVoiceProfileRequest,
    TrainVoiceResponse,
    VoiceProfileResponse,
)
from app.client.runpod_client import RunpodClient
from app.client.s3_client import S3Client
from app.client.supabase_client import SupabaseClient

router = APIRouter(prefix="/voice-profiles", tags=["voice-profiles"])


@router.post("", response_model=VoiceProfileResponse, status_code=201)
async def create_voice_profile(
    payload: CreateVoiceProfileRequest,
    principal: Principal = Depends(current_principal),
    supabase: SupabaseClient = Depends(get_supabase),
    s3: S3Client = Depends(get_s3),
) -> VoiceProfileResponse:
    return await voice_profile_controller.create(supabase, s3, principal.user_id, payload)


@router.post("/{voice_id}/train", response_model=TrainVoiceResponse)
async def train_voice(
    voice_id: str,
    principal: Principal = Depends(current_principal),
    supabase: SupabaseClient = Depends(get_supabase),
    s3: S3Client = Depends(get_s3),
    runpod: RunpodClient = Depends(get_runpod),
) -> TrainVoiceResponse:
    return await voice_profile_controller.train(
        supabase, s3, runpod, principal.user_id, principal.email, voice_id
    )
