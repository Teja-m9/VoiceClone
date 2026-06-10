from app.api.schemas.common import ApiModel


class CreateVoiceProfileRequest(ApiModel):
    name: str
    ref_audio_key: str
    duration_ms: int | None = None


class VoiceProfileResponse(ApiModel):
    id: str
    name: str
    status: str
    ref_audio_key: str
    duration_ms: int | None
    created_at: str


class TrainVoiceResponse(ApiModel):
    id: str
    tier: str
    training_status: str
