# RealMVP — API (FastAPI orchestrator)

Stateless control plane. Verifies Supabase JWTs, mints S3 presigned URLs, resolves
JioSaavn stream URLs, enforces the free-tier quota, triggers the Runpod GPU pipeline, and
finalizes jobs from the Runpod webhook. Heavy lifting (cloning) happens on the GPU worker;
this service never touches media bytes.

## Layout (per docs/CODING_GUIDELINES.md §2)
```
services/api/
├── main.py            # app factory, router registration, error envelope, logging
├── config.py          # the ONLY place env vars are read
├── requirements.txt
├── .env.example
└── app/
    ├── api/
    │   ├── routes/        # HTTP → controller wiring (thin)
    │   ├── controllers/   # orchestration
    │   ├── schemas/       # Pydantic DTOs (the API contract)
    │   └── services/      # business logic (job, quota, upload, voice_profile)
    ├── client/            # s3, supabase, runpod, jiosaavn
    ├── constants/         # enums, error codes
    ├── helpers/           # key builders, runpod payload
    ├── utils/             # hmac, logging
    └── errors.py          # domain exceptions
```

## Endpoints
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET  | `/health` | – | liveness |
| POST | `/uploads/presign` | JWT | presigned PUT for voice/avatar upload to S3 |
| POST | `/voice-profiles` | JWT | register a clone reference (after upload) |
| POST | `/jobs` | JWT | quota → resolve JioSaavn stream → presign IO → trigger Runpod (202) |
| GET  | `/jobs/{id}` | JWT | job status + fresh presigned output URLs |
| POST | `/webhooks/runpod?token=…` | token | finalize job (idempotent) |

## Flow
1. App uploads voice sample → S3 (presigned PUT) → `POST /voice-profiles`.
2. App picks a JioSaavn song + voice → `POST /jobs`.
3. API: reserve quota → resolve song stream URL → presign voice (GET) + output (PUT) →
   trigger Runpod with the payload + `?token` webhook URL.
4. Worker clones → uploads cover to S3 → Runpod calls `/webhooks/runpod`.
5. API marks job `done`, inserts a notification → Supabase Realtime pushes it to the app.

## Run locally
```bash
cd services/api
python -m venv .venv && source .venv/bin/activate   # (PowerShell: .venv\Scripts\Activate.ps1)
pip install -r requirements.txt
cp .env.example .env   # fill in Supabase, AWS S3, Runpod values
python main.py         # http://localhost:8000  (docs at /docs)
```

## Env (all read only in `config.py`)
Supabase (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_JWT_SECRET`), AWS S3
(`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET`,
`S3_ENDPOINT_URL?`), Runpod (`RUNPOD_API_KEY`, `RUNPOD_ENDPOINT_ID`,
`RUNPOD_WEBHOOK_SECRET`), JioSaavn (`SAAVN_API_URL`), and misc (`API_BASE_URL`,
`FREE_DAILY_QUOTA`, …). See `.env.example`.

## Mobile wiring
Point the app's `EXPO_PUBLIC_API_BASE_URL` at this service. With real Supabase keys in the
app (so `MOCK_MODE` is off), record → generate → playback runs end-to-end against this API.
