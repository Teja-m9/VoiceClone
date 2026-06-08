from app.api.schemas.uploads import PresignRequest, PresignResponse
from app.api.services import upload_service
from app.client.s3_client import S3Client


async def presign(s3: S3Client, user_id: str, payload: PresignRequest) -> PresignResponse:
    return await upload_service.create_presigned_upload(s3, user_id, payload)
