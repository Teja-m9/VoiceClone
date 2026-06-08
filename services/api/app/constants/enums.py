"""Enums mirroring the Supabase DB enums (see infra/supabase/migrations/0001_init.sql)."""
from enum import StrEnum


class Plan(StrEnum):
    FREE = "free"
    PREMIUM = "premium"


class JobStatus(StrEnum):
    QUEUED = "queued"
    PROCESSING = "processing"
    DONE = "done"
    FAILED = "failed"


class VoiceStatus(StrEnum):
    PENDING = "pending"
    READY = "ready"
    FAILED = "failed"


class NotifType(StrEnum):
    JOB_DONE = "job_done"
    JOB_FAILED = "job_failed"
    SUB_ACTIVATED = "sub_activated"
    SUB_EXPIRED = "sub_expired"
    SYSTEM = "system"


class UploadPurpose(StrEnum):
    VOICE_REF = "voice_ref"
    AVATAR = "avatar"
