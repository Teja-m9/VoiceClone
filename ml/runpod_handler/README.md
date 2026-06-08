# RealMVP — GPU Worker (Runpod Serverless)

Runs the AI-cover pipeline as a Runpod serverless handler:

```
download → Demucs (separate vocals) → Seed-VC (convert timbre to user) → FFmpeg (remix) → upload
```

The user never sings — the **original song's vocal stem** is converted to the user's voice
while the melody/pitch/timing are preserved (F0-conditioned Seed-VC).

## No credentials
The worker does all IO over **presigned URLs** supplied in the job payload, so it holds **no
cloud keys**. `config.py` only carries operational settings (log level, model dirs).

## Job contract
**Input** (`event["input"]`, built by the API's `build_clone_job_payload`):
```json
{
  "job_id": "uuid",
  "watermark": true,
  "inputs":  { "song_url": "…", "voice_ref_url": "https://s3-presigned-get…" },
  "outputs": { "audio_put_url": "https://s3-presigned-put…", "audio_key": "covers/<user>/<job>.mp3" }
}
```
**Return** (becomes Runpod's webhook `output`):
```json
{ "job_id": "uuid", "output_audio_key": "covers/…/x.mp3", "duration_ms": 184000 }
```
On a handled failure: `{ "job_id": "…", "failed": true, "error_code": "…", "error_detail": "…" }`.

## Stages (`pipeline/`, each a pure function)
- `separate.py` — Demucs `--two-stems vocals` → `vocals.wav`, `no_vocals.wav`.
- `convert.py` — Seed-VC inference (F0-conditioned) → vocal in the user's timbre.
- `mix.py` — FFmpeg `amix` + `loudnorm`; faint watermark tone on the free tier.
- `io.py` — presigned download/upload.

## Build & deploy
```bash
docker build -t realmvp-clone .
# push to a registry Runpod can pull, then create a Serverless endpoint from it.
```
Set the Runpod endpoint id + API key in the **API**'s `.env` (`RUNPOD_ENDPOINT_ID`,
`RUNPOD_API_KEY`, `RUNPOD_WEBHOOK_SECRET`). The API triggers this worker and authenticates
the callback via `?token=<RUNPOD_WEBHOOK_SECRET>` on the webhook URL.

## NOTE on Seed-VC CLI
`convert.py` shells out to `inference.py` in the cloned Seed-VC repo. Flag names vary by
commit — if conversion fails, align the args in `convert.py` with the version pinned in the
`Dockerfile`. The function contract (source + target in, wav out) is stable.
