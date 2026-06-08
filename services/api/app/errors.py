"""Domain exceptions. Services raise these; the exception handler in main.py maps them to
HTTP responses. Services never raise HTTPException directly (per coding guidelines)."""
from app.constants.errors import ErrorCode


class DomainError(Exception):
    """Base domain error carrying a stable code, HTTP status, and message."""

    code: ErrorCode = ErrorCode.INTERNAL
    status: int = 500

    def __init__(self, message: str, details: dict | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details


class NotFoundError(DomainError):
    code = ErrorCode.NOT_FOUND
    status = 404


class ForbiddenError(DomainError):
    code = ErrorCode.FORBIDDEN
    status = 403


class UnauthorizedError(DomainError):
    code = ErrorCode.UNAUTHORIZED
    status = 401


class QuotaExceededError(DomainError):
    code = ErrorCode.QUOTA_EXCEEDED
    status = 429


class VoiceNotReadyError(DomainError):
    code = ErrorCode.VOICE_NOT_READY
    status = 403


class UploadNotFoundError(DomainError):
    code = ErrorCode.UPLOAD_NOT_FOUND
    status = 400


class SongUnavailableError(DomainError):
    code = ErrorCode.SONG_UNAVAILABLE
    status = 422


class WebhookSignatureError(DomainError):
    code = ErrorCode.WEBHOOK_BAD_SIG
    status = 401


class UpstreamError(DomainError):
    code = ErrorCode.UPSTREAM_RUNPOD
    status = 502
