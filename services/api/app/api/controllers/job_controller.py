from app.api.schemas.jobs import CreateJobRequest, JobResponse
from app.api.services import job_service
from app.client.jiosaavn_client import JioSaavnClient
from app.client.runpod_client import RunpodClient
from app.client.s3_client import S3Client
from app.client.supabase_client import SupabaseClient


async def create(
    *,
    supabase: SupabaseClient,
    s3: S3Client,
    runpod: RunpodClient,
    jiosaavn: JioSaavnClient,
    user_id: str,
    payload: CreateJobRequest,
) -> JobResponse:
    return await job_service.create_job(
        supabase=supabase,
        s3=s3,
        runpod=runpod,
        jiosaavn=jiosaavn,
        user_id=user_id,
        req=payload,
    )


async def get(supabase: SupabaseClient, s3: S3Client, user_id: str, job_id: str) -> JobResponse:
    return await job_service.get_job(supabase, s3, user_id, job_id)
