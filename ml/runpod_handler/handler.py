"""Runpod serverless entry point. Composes the pure pipeline stages:

  download → Demucs (separate) → Seed-VC (convert) → FFmpeg (remix) → upload

The return value becomes Runpod's webhook `output`; we make it carry our `job_id` and the
output key so the API can resolve and finalize the job. Handled failures return a `failed`
payload (still carrying job_id) so the API can mark the job failed with a reason."""
import logging
import shutil
import tempfile

import runpod

from config import config
from pipeline.convert import convert_voice
from pipeline.io import download, upload_put
from pipeline.mix import probe_duration_ms, remix
from pipeline.separate import separate_stems

logging.basicConfig(level=getattr(logging, config.log_level.upper(), logging.INFO))
log = logging.getLogger("runpod_handler")


def handler(event: dict) -> dict:
    inp = event.get("input", {})
    job_id = inp.get("job_id", "unknown")
    inputs = inp.get("inputs", {})
    outputs = inp.get("outputs", {})
    watermark = bool(inp.get("watermark", True))

    # Deterministic workdir keyed by job_id (idempotent: retries overwrite the same paths).
    workdir = tempfile.mkdtemp(prefix=f"job_{job_id}_")
    try:
        log.info("job %s: downloading inputs", job_id)
        song = download(inputs["song_url"], f"{workdir}/song.m4a")
        voice_ref = download(inputs["voice_ref_url"], f"{workdir}/voice_ref.m4a")

        log.info("job %s: separating stems (demucs)", job_id)
        vocals, instrumental = separate_stems(song, workdir)

        log.info("job %s: converting voice (seed-vc)", job_id)
        converted = convert_voice(vocals, voice_ref, workdir)

        log.info("job %s: remixing (ffmpeg, watermark=%s)", job_id, watermark)
        cover = remix(converted, instrumental, watermark, workdir)

        log.info("job %s: uploading output", job_id)
        upload_put(cover, outputs["audio_put_url"], "audio/mpeg")

        return {
            "job_id": job_id,
            "output_audio_key": outputs["audio_key"],
            "duration_ms": probe_duration_ms(cover),
        }
    except Exception as exc:  # noqa: BLE001 — report any stage failure back with the job_id
        log.exception("job %s failed", job_id)
        return {
            "job_id": job_id,
            "failed": True,
            "error_code": type(exc).__name__,
            "error_detail": str(exc)[:500],
        }
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


runpod.serverless.start({"handler": handler})
