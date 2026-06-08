from fastapi import APIRouter, Depends

from app.api.controllers import job_controller
from app.api.deps import (
    Principal,
    current_principal,
    get_jiosaavn,
    get_runpod,
    get_s3,
    get_supabase,
)
from app.api.schemas.jobs import CreateJobRequest, JobResponse
from app.client.jiosaavn_client import JioSaavnClient
from app.client.runpod_client import RunpodClient
from app.client.s3_client import S3Client
from app.client.supabase_client import SupabaseClient

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("", response_model=JobResponse, status_code=202)
async def create_job(
    payload: CreateJobRequest,
    principal: Principal = Depends(current_principal),
    supabase: SupabaseClient = Depends(get_supabase),
    s3: S3Client = Depends(get_s3),
    runpod: RunpodClient = Depends(get_runpod),
    jiosaavn: JioSaavnClient = Depends(get_jiosaavn),
) -> JobResponse:
    return await job_controller.create(
        supabase=supabase,
        s3=s3,
        runpod=runpod,
        jiosaavn=jiosaavn,
        user_id=principal.user_id,
        payload=payload,
    )


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: str,
    principal: Principal = Depends(current_principal),
    supabase: SupabaseClient = Depends(get_supabase),
    s3: S3Client = Depends(get_s3),
) -> JobResponse:
    return await job_controller.get(supabase, s3, principal.user_id, job_id)
