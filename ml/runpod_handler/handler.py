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
from pipeline.finetune import finetune_voice
from pipeline.io import download, upload_put
from pipeline.mix import probe_duration_ms, remix
from pipeline.separate import separate_stems

logging.basicConfig(level=getattr(logging, config.log_level.upper(), logging.INFO))
log = logging.getLogger("runpod_handler")


def _handle_train(job_id: str, inputs: dict, outputs: dict, workdir: str) -> dict:
    """Pro Voice training: fine-tune on the user's sample, upload the checkpoint."""
    log.info("job %s: PRO VOICE training", job_id)
    voice_ref = download(inputs["voice_ref_url"], f"{workdir}/voice_ref.m4a")
    checkpoint = finetune_voice(voice_ref, run_name=job_id, workdir=workdir)
    upload_put(checkpoint, outputs["model_put_url"], "application/octet-stream")
    return {"job_id": job_id, "model_key": outputs["model_key"], "trained": True}


def handler(event: dict) -> dict:
    inp = event.get("input", {})
    job_id = inp.get("job_id", "unknown")
    mode = inp.get("mode", "cover")
    inputs = inp.get("inputs", {})
    outputs = inp.get("outputs", {})
    watermark = bool(inp.get("watermark", True))
    preview = bool(inp.get("preview", False))

    # Deterministic workdir keyed by job_id (idempotent: retries overwrite the same paths).
    workdir = tempfile.mkdtemp(prefix=f"job_{job_id}_")
    try:
        if mode == "train":
            return _handle_train(job_id, inputs, outputs, workdir)

        log.info("job %s: downloading inputs", job_id)
        song = download(inputs["song_url"], f"{workdir}/song.m4a")
        voice_ref = download(inputs["voice_ref_url"], f"{workdir}/voice_ref.m4a")

        # Pro Voice: if a fine-tuned model is supplied, fetch it and convert with it.
        checkpoint = model_config = None
        if inputs.get("model_url"):
            checkpoint = download(inputs["model_url"], f"{workdir}/voice_model.pth")
            if inputs.get("model_config_url"):
                model_config = download(inputs["model_config_url"], f"{workdir}/voice_model.yml")

        log.info("job %s: separating stems (demucs)", job_id)
        vocals, instrumental = separate_stems(song, workdir)

        log.info("job %s: converting voice (seed-vc, pro=%s)", job_id, bool(checkpoint))
        converted = convert_voice(vocals, voice_ref, workdir, checkpoint=checkpoint, model_config=model_config)

        log.info("job %s: remixing (ffmpeg, watermark=%s preview=%s)", job_id, watermark, preview)
        cover = remix(converted, instrumental, watermark, workdir, preview=preview)

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
