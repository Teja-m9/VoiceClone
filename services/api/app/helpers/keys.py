"""Domain-aware S3 object key builders. Centralizing key layout means a storage reorg is
a one-file change. Keys are namespaced by user so presigns can be scoped per tenant."""
import uuid

from app.constants.enums import UploadPurpose


def new_voice_ref_key(user_id: str) -> str:
    return f"voice_ref/{user_id}/{uuid.uuid4().hex}.m4a"


def new_avatar_key(user_id: str) -> str:
    return f"avatar/{user_id}/{uuid.uuid4().hex}.jpg"


def upload_key(purpose: UploadPurpose, user_id: str) -> str:
    if purpose is UploadPurpose.VOICE_REF:
        return new_voice_ref_key(user_id)
    return new_avatar_key(user_id)


def output_audio_key(user_id: str, job_id: str) -> str:
    return f"covers/{user_id}/{job_id}.mp3"


def output_reel_key(user_id: str, job_id: str) -> str:
    return f"covers/{user_id}/{job_id}.mp4"


def belongs_to_user(key: str, user_id: str, prefix: str = "voice_ref") -> bool:
    """Guard against cross-tenant key injection from client-supplied keys."""
    return key.startswith(f"{prefix}/{user_id}/")
