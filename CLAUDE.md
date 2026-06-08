# RealMVP — AI Voice-Cloning & Singing App

Mobile app: record 30–60s of your voice → zero-shot clone → your voice "sings" any
licensed song → share the AI cover. See [plan.md](plan.md) for product scope.

## Architecture (read these first)
- **High-Level Design:** [docs/HLD.md](docs/HLD.md)
- **Low-Level Design:** [docs/LLD.md](docs/LLD.md) — schema, API contracts, hook signatures (source of truth for implementation)
- **Coding standards:** [docs/CODING_GUIDELINES.md](docs/CODING_GUIDELINES.md) — **follow these for all code**

## Agents (in `.claude/agents/`)
Use these existing agents when working on design — do NOT recreate them:
- `high-level-design` → architecture / HLD
- `low-level-design` → schemas, contracts, class/method design / LLD
- `coding-guideline` → enforces the FastAPI layout + coding standards when writing backend code

## Monorepo layout
```
apps/mobile/        Expo React Native app (TypeScript, expo-router, Reanimated)  ← built first
services/api/       FastAPI orchestrator (layered: routes→controllers→services→clients)
ml/runpod_handler/  Runpod serverless GPU: Demucs + Seed-VC + FFmpeg
infra/supabase/     SQL migrations (schema, RLS, triggers, realtime)
docs/               HLD, LLD, coding guidelines
```

## Tech stack (locked)
- Mobile: Expo + React Native + TypeScript, expo-router, Reanimated, `@supabase/supabase-js`, expo-audio/expo-av, expo-sharing.
- Backend: FastAPI (Python). Env read ONLY via `config.py`. Verifies Supabase JWT.
- GPU: Runpod Serverless (pay-per-second, scale-to-zero). NOT a 24/7 pod, NOT Celery/Redis.
- Data/Auth/Realtime: Supabase (Postgres + RLS + Realtime). Storage: Cloudflare R2 (presigned URLs).
- Payments: Razorpay. Ads: AdMob (free tier).

## Design language (ctrl.xyz-inspired)
Dark near-black background, vibrant **bento-box** card grid, neon gradient accents
(violet → magenta → cyan), generous spacing, rounded cards, smooth Reanimated motion
(entrance fade/slide, press-scale, animated gradients). All design tokens live in
`apps/mobile/src/theme/` — never hardcode colors/spacing in components.

## Everything is realtime
Auth, profiles, notifications, and job status are all live via Supabase Realtime — the
client subscribes, it never polls. Hooks: `useAuth`, `useProfile`, `useRealtimeJob`,
`useNotifications`.

## Conventions
- Strict TypeScript, no `any`. PascalCase components, `use`-prefixed camelCase hooks.
- Data access only via hooks — no inline Supabase calls inside components.
- Env via `app.config.ts` / `EXPO_PUBLIC_*`, never hardcoded.
