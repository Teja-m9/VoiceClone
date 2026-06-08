from typing import Literal

from app.api.schemas.common import ApiModel
from app.constants.enums import UploadPurpose


class PresignRequest(ApiModel):
    purpose: UploadPurpose
    content_type: Literal["audio/wav", "audio/m4a", "audio/mpeg", "image/jpeg", "image/png"]
    byte_size: int


class PresignResponse(ApiModel):
    object_key: str
    upload_url: str
    expires_in: int
    max_bytes: int
