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
) -> dict:
    return {
        "job_id": job_id,
        "kind": "clone_sing",
        "watermark": watermark,
        # Free tier gets a 30s preview; premium gets the full song.
        "preview": preview,
        "inputs": {
            "song_url": song_stream_url,
            "voice_ref_url": voice_ref_get_url,
        },
        "outputs": {
            "audio_put_url": output_audio_put_url,
            "audio_key": output_audio_key,
        },
    }
