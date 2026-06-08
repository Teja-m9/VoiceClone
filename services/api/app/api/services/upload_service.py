"""Mint presigned PUT URLs for direct-to-S3 uploads. Server generates the key (clients
cannot choose keys) and scopes it to the user."""
from app.api.schemas.uploads import PresignRequest, PresignResponse
from app.client.s3_client import S3Client
from app.helpers.keys import upload_key
from config import config

_CONTENT_TYPE = {
    "voice_ref": "audio/m4a",
    "avatar": "image/jpeg",
}


async def create_presigned_upload(
    s3: S3Client, user_id: str, req: PresignRequest
) -> PresignResponse:
    key = upload_key(req.purpose, user_id)
    url = s3.presign_put(key, req.content_type, config.presign_put_ttl)
    return PresignResponse(
        object_key=key,
        upload_url=url,
        expires_in=config.presign_put_ttl,
        max_bytes=config.max_upload_bytes,
    )
