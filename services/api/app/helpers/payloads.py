"""Builds the Runpod GPU job payload (the contract the worker consumes)."""


def build_clone_job_payload(
    *,
    job_id: str,
    watermark: bool,
    preview: bool,
    voice_ref_get_url: str,
    song_stream_url: str,
    output_audio_put_url: str,
    output_audio_key: str,
    voice_model_get_url: str | None = None,
) -> dict:
    inputs = {
        "song_url": song_stream_url,
        "voice_ref_url": voice_ref_get_url,
    }
    # Pro Voice: a fine-tuned checkpoint the worker loads for a higher-fidelity clone.
    if voice_model_get_url:
        inputs["model_url"] = voice_model_get_url
    return {
        "job_id": job_id,
        "kind": "clone_sing",
        "watermark": watermark,
        # Free tier gets a 30s preview; premium gets the full song.
        "preview": preview,
        "inputs": inputs,
        "outputs": {
            "audio_put_url": output_audio_put_url,
            "audio_key": output_audio_key,
        },
    }


def build_train_job_payload(
    *,
    voice_id: str,
    voice_ref_get_url: str,
    model_put_url: str,
    model_key: str,
) -> dict:
    """Pro Voice training job. `job_id` carries the voice id so the webhook finalizes the
    voice profile (training has no jobs row)."""
    return {
        "job_id": voice_id,
        "mode": "train",
        "inputs": {"voice_ref_url": voice_ref_get_url},
        "outputs": {"model_put_url": model_put_url, "model_key": model_key},
    }
