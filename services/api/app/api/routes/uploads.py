from fastapi import APIRouter, Depends

from app.api.controllers import upload_controller
from app.api.deps import Principal, current_principal, get_s3
from app.api.schemas.uploads import PresignRequest, PresignResponse
from app.client.s3_client import S3Client

router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.post("/presign", response_model=PresignResponse)
async def presign(
    payload: PresignRequest,
    principal: Principal = Depends(current_principal),
    s3: S3Client = Depends(get_s3),
) -> PresignResponse:
    return await upload_controller.presign(s3, principal.user_id, payload)
