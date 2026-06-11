from app.api.schemas.common import ApiModel


class CreateJobRequest(ApiModel):
    song_id: str  # JioSaavn song id
    voice_profile_id: str
    idempotency_key: str
    gender: str | None = None  # 'male' | 'female' — pitch the vocal to the user's register


class JobResponse(ApiModel):
    id: str
    status: str
    song_id: str
    voice_profile_id: str
    output_audio_url: str | None = None
    output_reel_url: str | None = None
    error_code: str | None = None
    created_at: str
    completed_at: str | None = None
