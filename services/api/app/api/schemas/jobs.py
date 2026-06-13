from app.api.schemas.common import ApiModel


class CreateJobRequest(ApiModel):
    song_id: str  # JioSaavn song id
    voice_profile_id: str
    idempotency_key: str
    gender: str | None = None  # 'male' | 'female' — pitch the vocal to the user's register
    vocal_level: str | None = None  # 'soft' | 'balanced' | 'loud' — voice-vs-music balance
    style: str | None = None  # 'studio' | 'live' | 'lofi' | 'reverb' — vocal vibe preset
    voice_profile_id_2: str | None = None  # duet: 2nd voice (female-pitched parts use this)


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
