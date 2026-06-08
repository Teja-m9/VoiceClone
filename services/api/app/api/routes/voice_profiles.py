from fastapi import APIRouter, Depends

from app.api.controllers import voice_profile_controller
from app.api.deps import Principal, current_principal, get_s3, get_supabase
from app.api.schemas.voice_profiles import CreateVoiceProfileRequest, VoiceProfileResponse
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
