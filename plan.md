# RealMVP — AI Voice-Cloning & Singing App (Phase 1 MVP Plan)

## Context

You're building a mobile app where a user records 30–60s of their voice, the app
clones it, and their cloned voice "sings" any song — output is a shareable
audio/video reel. The viral hook is the instant clone; the viral loop is sharing
covers (especially into your friend's music app and onto IG/WhatsApp).

Constraints that shape this plan:
- **Greenfield** — `RealMVP/` is empty. We build the whole skeleton from scratch.
- **No local GPU** — ThinkPad i7 (CPU-only). You cannot realistically train or run
  the ML pipeline locally. Cloud GPU from day one (Colab for first POC, then Runpod).
- **Demo-ready quality** — output must impress your friend's audience in a pitch.
- **Scope = Full Phase 1 MVP**: voice clone + sing-over-a-track + share, with auth,
  storage, payments, and ads wired in.

### Two decisions baked into this plan (with rationale)

1. **Zero-shot voice conversion (Seed-VC), NOT RVC, for the MVP.**
   RVC needs a *trained model per user voice* (minutes-to-an-hour of GPU per clone) —
   that latency destroys the "record → instantly hear yourself sing" hook. Zero-shot
   models (Seed-VC, R2-SVC) clone from a short sample with no training and are now
   demo-ready quality. **RVC stays as a Phase 2 "Pro Voice" upgrade** (offline-trained,
   highest fidelity, paid tier). This gives instant onboarding now + a premium quality
   lever later.

2. **Runpod Serverless for GPU inference, NOT a 24/7 pod + Celery/Redis.**
   Audio jobs are bursty. Serverless bills per-second and scales to zero, so you pay
   ~nothing when idle. It replaces the "GPU server + Celery + Redis" box in the original
   stack with a single autoscaling inference endpoint. FastAPI just orchestrates jobs.

### How "sing over a track" actually works (important)
The user does **not** sing. The pipeline takes the *original song's vocal stem* and
converts its **timbre** to the user's cloned voice while preserving the original
melody/pitch/timing. This is the "AI cover" format. Flow:

`song → Demucs (split vocals/instrumental) → Seed-VC (convert vocal timbre to user) → FFmpeg (remix converted vocal + instrumental) → optional FFmpeg video for reels`

---

## Architecture

```
realmvp/                         (monorepo)
├─ apps/
│  └─ mobile/                    Expo React Native app
├─ services/
│  └─ api/                       FastAPI — auth, job orchestration, R2 URLs, webhooks
├─ ml/
│  └─ runpod_handler/            Serverless GPU handler: Demucs + Seed-VC + FFmpeg
├─ infra/
│  └─ supabase/                  SQL migrations (schema, RLS, realtime)
└─ docs/
```

**Data/control flow for one cover:**
1. Mobile records voice → uploads to R2 via presigned URL → calls API `POST /voice-profiles`.
2. Mobile picks a licensed song + voice profile → `POST /jobs`.
3. API writes a `jobs` row (status=`queued`), triggers the Runpod Serverless endpoint
   with `{voice_ref_url, song_url, job_id, webhook_url}`.
4. GPU handler runs the pipeline, uploads result to R2, calls API webhook.
5. API sets `jobs.status=done, output_url=...`. Supabase Realtime pushes the update to
   the mobile app's subscribed `jobs` row → playback + share screen.

### Component responsibilities

**`apps/mobile` (Expo + TypeScript)** — 4 core screens:
- **Record**: `expo-audio` to capture 30–60s; upload to R2 (presigned PUT).
- **Pick song**: list from Supabase `songs` table (licensed/public-domain catalog only).
- **Processing**: subscribe to the `jobs` row via Supabase Realtime; show progress; AdMob
  interstitial here (natural 30–60s ad slot).
- **Playback + Share**: `expo-av` playback; `expo-sharing` / `react-native-share` to IG
  Reels, WhatsApp, and a native "Share to [friend's app]" target.
- Auth via `@supabase/supabase-js`. **Note:** AdMob + native share require an **EAS dev
  build / custom client — not Expo Go.** Plan to set up EAS early.

**`services/api` (FastAPI)** — stateless orchestrator:
- `POST /auth/...` not needed — verify Supabase JWT on each request (shared secret).
- `POST /uploads/presign` → R2 presigned PUT URL.
- `POST /voice-profiles` → register a clone reference.
- `POST /jobs` → quota check (free=3/day), create job row, trigger Runpod.
- `POST /webhooks/runpod` → mark job done/failed, set output URL.
- `POST /webhooks/razorpay` → activate/cancel premium subscription.
- Enforce free-tier limits + watermarking flag here.

**`ml/runpod_handler` (Python, GPU)** — the inference pipeline, deployed as a Runpod
Serverless endpoint (Docker image with CUDA, demucs, seed-vc, ffmpeg):
- Download voice ref + song from R2.
- `Demucs` → vocal + instrumental stems.
- `Seed-VC` → convert vocal stem timbre to user voice (preserve pitch/melody).
- `FFmpeg` → mix converted vocal + instrumental; loudness-normalize; apply watermark
  (audio tag/overlay) for free tier; render optional vertical video for reels.
- Upload output to R2; POST to API webhook.

**`infra/supabase`** — Postgres + Auth + Realtime. Core tables:
- `profiles` (user, plan, daily_usage_count, usage_reset_at)
- `voice_profiles` (user_id, r2_key, label)
- `songs` (title, artist, r2_instrumental_key, license_source) — **catalog is gated to
  licensed / public-domain / user-uploaded only**
- `jobs` (user_id, voice_profile_id, song_id, status, output_url, error)
- `subscriptions` (user_id, razorpay_sub_id, status, current_period_end)
- Row-Level Security so users only see their own rows; Realtime enabled on `jobs`.

**External services:** Cloudflare R2 (S3-compatible storage, zero egress), Razorpay
(premium subscriptions ₹99–149/mo), Google AdMob (free-tier interstitials).

---

## Build sequence (milestones, mapped to your ~8-week timeline)

**M0 — Proof of concept (Days 1–3).** *Before any app code.*
- On **Google Colab (free T4 GPU)** — you have no local GPU — run end-to-end manually:
  one song → Demucs split → Seed-VC convert to your recorded voice → FFmpeg remix.
- Goal: confirm the pipeline produces a demo-ready cover you can play for your friend.
- Output: a 30-second AI cover of your own voice. This is your pitch asset.

**M1 — Pipeline as a service (Week 1–2).**
- Containerize the pipeline; deploy as a Runpod **Serverless** endpoint.
- Wrap with FastAPI: `/jobs` trigger + `/webhooks/runpod` callback. Test latency & cost
  per job. Wire R2 for input/output via presigned URLs.

**M2 — Mobile core loop (Week 3–4).**
- Expo app + EAS dev build. Record → upload → pick song → processing (Realtime) →
  playback → share. Ugly but functional. Supabase auth + schema live.

**M3 — Monetization & polish (Week 5).**
- Free-tier quota (3/day) + watermark; Razorpay premium; AdMob interstitial on
  processing screen; "Share to [friend's app]" target.

**M4 — Beta & launch (Week 6–8).**
- Polish UI; soft-launch to your friend's audience; instrument analytics; fix; launch.

---

## Legal guardrails (build in from day one — non-negotiable)
- **Voices:** only the user's *own* voice. ToS prohibits cloning others without consent;
  add a consent checkbox at record time. (ElevenLabs-style policy.)
- **Songs:** catalog limited to your friend's licensed library, public-domain tracks, or
  user-uploaded instrumentals. **Never scrape copyrighted tracks.** The `songs` table has
  a `license_source` field enforced as required.
- **Watermark** free-tier output (audible/inaudible tag) for attribution + abuse tracing.

## Cost reality (no local GPU)
- POC: Colab free tier (₹0) or Colab Pro if you need longer runtimes.
- Dev/early run: Runpod Serverless RTX 4090 ~$0.34/hr *of active compute* — a ~30–60s
  job costs cents. Scale-to-zero means near-zero idle cost.
- R2: ~$0.015/GB-month storage, **zero egress**.
- Supabase + Razorpay: free/usage tiers fine for beta.

## Known risks flagged for later phases
- **Phase 2 dubbing / Telugu moat:** Coqui shut down (Dec 2025); XTTS-v2 is
  community-maintained and **never supported Telugu**. The regional-language moat will
  need a fine-tuned TTS or an alternative model — treat as Phase 2 research, not assumed.
- **Expo limits:** AdMob + native share need EAS custom build (not Expo Go) — set up EAS
  in M2, not at the end.
- **Cold starts:** Runpod Serverless cold-start adds seconds; acceptable behind the
  "processing 30–60s" UX, but keep a min-worker warm if it hurts the demo.

---

## Verification (how we'll prove each milestone works)
- **M0:** Play the generated AI cover — does it sound like you, on-melody, demo-ready?
- **M1:** `curl POST /jobs` → poll/webhook → download output from R2; confirm a job costs
  cents and completes in target latency.
- **M2:** On a physical phone (EAS dev build): record → pick → process → playback →
  share to WhatsApp succeeds end-to-end.
- **M3:** Free user blocked after 3 covers/day with watermark; premium user (Razorpay
  test mode) gets unlimited + no watermark; AdMob test ad shows on processing screen.
- **M4:** 10–20 real beta users from your friend's audience complete a cover and share it.

## Next step when you're ready to build
The first real step (M0) is to write the **Colab notebook** for the
Demucs → Seed-VC → FFmpeg proof of concept — your hardware can't run it locally, so Colab
is step one — then scaffold the monorepo skeleton (`apps/mobile`, `services/api`,
`ml/runpod_handler`, `infra/supabase`).
