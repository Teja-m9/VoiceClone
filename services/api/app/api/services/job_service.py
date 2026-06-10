"""Job orchestration: create a clone job (quota + JioSaavn resolve + S3 presign + Runpod
trigger), complete it from the Runpod webhook (idempotent), and read it back with fresh
output URLs. This is the facade the controllers call."""
from datetime import datetime, timezone

from app.api.schemas.jobs import CreateJobRequest, JobResponse
from app.api.schemas.webhooks import RunpodWebhook
from app.api.services import quota_service
from app.client.jiosaavn_client import JioSaavnClient
from app.client.runpod_client import RunpodClient
from app.client.s3_client import S3Client
from app.client.supabase_client import SupabaseClient
from app.constants.admins import is_admin_email
from app.constants.enums import JobStatus, NotifType, VoiceStatus
from app.errors import (
    NotFoundError,
    QuotaExceededError,
    SongUnavailableError,
    UpstreamError,
    VoiceNotReadyError,
)
from app.helpers.keys import output_audio_key
from app.helpers.payloads import build_clone_job_payload
from app.utils.logging_config import get_logger
from config import config

log = get_logger("job_service")

_TERMINAL = {JobStatus.DONE.value, JobStatus.FAILED.value}


async def create_job(
    *,
    supabase: SupabaseClient,
    s3: S3Client,
    runpod: RunpodClient,
    jiosaavn: JioSaavnClient,
    user_id: str,
    email: str | None = None,
    req: CreateJobRequest,
) -> JobResponse:
    # 1. Idempotency replay.
    existing = await supabase.select_one(
        "jobs", {"user_id": user_id, "idempotency_key": req.idempotency_key}
    )
    if existing:
        return await _to_response(s3, existing)

    # 2. Validate the voice profile belongs to the user and is ready.
    vp = await supabase.select_one("voice_profiles", {"id": req.voice_profile_id})
    if not vp or vp["user_id"] != user_id:
        raise NotFoundError("Voice profile not found")
    if vp["status"] != VoiceStatus.READY.value:
        raise VoiceNotReadyError("Voice profile is not ready yet")

    # 3. Resolve the JioSaavn stream URL for the worker to download.
    song_url = await jiosaavn.resolve_stream_url(req.song_id)
    if not song_url:
        raise SongUnavailableError("Could not resolve the song stream")

    # 4. Quota — admins bypass entirely; otherwise reserve (free => daily cap,
    #    premium => per-plan allowance: monthly 20 / quarterly 100).
    if is_admin_email(email):
        is_premium = True
    else:
        quota = await quota_service.reserve(supabase, user_id)
        if not quota.allowed:
            msg = (
                "You've used all the songs in your plan for this period"
                if quota.premium
                else "Daily free limit reached"
            )
            raise QuotaExceededError(msg, details={"remaining": quota.remaining})
        is_premium = quota.premium

    # 5. Insert the job row (queued).
    row = await supabase.insert(
        "jobs",
        {
            "user_id": user_id,
            "song_id": req.song_id,
            "voice_profile_id": req.voice_profile_id,
            "status": JobStatus.QUEUED.value,
            "idempotency_key": req.idempotency_key,
            "watermark": not is_premium,
            "quota_consumed": True,
        },
    )
    job_id = row["id"]

    # 6. Presign IO + trigger Runpod. Voice clips live in Supabase Storage ('voices');
    #    generated covers go to S3.
    out_key = output_audio_key(user_id, job_id)
    voice_url = await supabase.create_signed_url("voices", vp["ref_audio_key"], config.presign_get_ttl)
    if not voice_url:
        raise UpstreamError("Could not sign the voice reference")
    # Pro Voice: if this voice has a ready fine-tuned model, hand it to the worker.
    model_url = None
    if vp.get("tier") == "pro" and vp.get("training_status") == "ready" and vp.get("model_key"):
        model_url = s3.presign_get(vp["model_key"], config.presign_get_ttl)
    payload = build_clone_job_payload(
        job_id=job_id,
        watermark=not is_premium,
        preview=not is_premium,  # free → 30s preview, premium → full song
        voice_ref_get_url=voice_url,
        song_stream_url=song_url,
        output_audio_put_url=s3.presign_put(out_key, "audio/mpeg", config.presign_get_ttl),
        output_audio_key=out_key,
        voice_model_get_url=model_url,
    )
    # Runpod has no webhook HMAC; we authenticate via a secret token in the callback URL.
    webhook_url = f"{config.api_base_url}/webhooks/runpod?token={config.runpod_webhook_secret}"
    runpod_id = await runpod.trigger(payload, webhook_url)
    await supabase.update("jobs", {"id": job_id}, {"runpod_job_id": runpod_id})

    log.info("job created job_id=%s user_id=%s runpod=%s", job_id, user_id, runpod_id)
    return await _to_response(s3, {**row, "output_audio_key": out_key})


async def complete_from_webhook(supabase: SupabaseClient, hook: RunpodWebhook) -> None:
    """Idempotent terminal transition driven by the Runpod webhook.

    Runpod posts {id, status, output}; our handler makes `output` carry `job_id` and the
    result keys (or `failed`/`error_*` on a handled failure). We resolve our job by the
    embedded job_id, falling back to the Runpod job id."""
    out = hook.output or {}
    job_id = out.get("job_id")
    job = (
        await supabase.select_one("jobs", {"id": job_id})
        if job_id
        else await supabase.select_one("jobs", {"runpod_job_id": hook.id})
    )
    if not job:
        log.warning("webhook for unknown job (job_id=%s runpod=%s)", job_id, hook.id)
        return
    if job["status"] in _TERMINAL:
        return  # already terminal — webhook retries are no-ops

    job_id = job["id"]
    now = datetime.now(timezone.utc).isoformat()
    failed = hook.status == "FAILED" or bool(out.get("failed"))

    if not failed:
        await supabase.update(
            "jobs",
            {"id": job_id},
            {
                "status": JobStatus.DONE.value,
                "output_audio_key": out.get("output_audio_key"),
                "output_reel_key": out.get("output_reel_key"),
                "completed_at": now,
            },
        )
        await _notify(supabase, job["user_id"], NotifType.JOB_DONE, "Your cover is ready 🎤",
                      "Tap to listen and share.", job_id)
    else:
        await supabase.update(
            "jobs",
            {"id": job_id},
            {
                "status": JobStatus.FAILED.value,
                "error_code": out.get("error_code", "PIPELINE_FAILED"),
                "error_detail": str(out.get("error_detail", ""))[:500],
                "completed_at": now,
            },
        )
        await quota_service.release(supabase, job["user_id"])  # failures don't cost a credit
        await _notify(supabase, job["user_id"], NotifType.JOB_FAILED, "Cover failed",
                      "Something went wrong — try again, it won't use a credit.", job_id)


async def complete_training_from_webhook(supabase: SupabaseClient, hook: RunpodWebhook) -> None:
    """Finalize a Pro Voice training run. The worker sets output.job_id = the voice id
    (training has no jobs row); we flip the voice profile to pro/ready or failed."""
    out = hook.output or {}
    voice_id = out.get("job_id")
    if not voice_id:
        log.warning("training webhook missing voice id (runpod=%s)", hook.id)
        return
    failed = hook.status == "FAILED" or bool(out.get("failed"))
    if failed:
        await supabase.update("voice_profiles", {"id": voice_id}, {"training_status": "failed"})
        log.warning("pro voice training failed voice=%s", voice_id)
        return
    await supabase.update(
        "voice_profiles",
        {"id": voice_id},
        {"training_status": "ready", "tier": "pro", "model_key": out.get("model_key")},
    )
    log.info("pro voice training ready voice=%s", voice_id)


async def get_job(supabase: SupabaseClient, s3: S3Client, user_id: str, job_id: str) -> JobResponse:
    row = await supabase.select_one("jobs", {"id": job_id})
    if not row or row["user_id"] != user_id:
        raise NotFoundError("Job not found")
    return await _to_response(s3, row)


async def _to_response(s3: S3Client, row: dict) -> JobResponse:
    audio_url = (
        s3.presign_get(row["output_audio_key"], config.presign_get_ttl)
        if row.get("output_audio_key")
        else None
    )
    reel_url = (
        s3.presign_get(row["output_reel_key"], config.presign_get_ttl)
        if row.get("output_reel_key")
        else None
    )
    return JobResponse(
        id=row["id"],
        status=row["status"],
        song_id=row["song_id"],
        voice_profile_id=row["voice_profile_id"],
        output_audio_url=audio_url,
        output_reel_url=reel_url,
        error_code=row.get("error_code"),
        created_at=row["created_at"],
        completed_at=row.get("completed_at"),
    )


async def _notify(
    supabase: SupabaseClient, user_id: str, ntype: NotifType, title: str, body: str, job_id: str
) -> None:
    await supabase.insert(
        "notifications",
        {"user_id": user_id, "type": ntype.value, "title": title, "body": body, "job_id": job_id},
    )
