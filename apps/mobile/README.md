# RealMVP — Mobile App (Expo / React Native)

The user-facing app: record your voice → clone it → make AI covers → share. Dark,
ctrl.xyz-inspired design (neon gradients, bento cards, Reanimated motion). All design
tokens live in [`src/theme/`](src/theme) — never hardcode colors/spacing.

## Stack
Expo SDK 53 · React Native 0.79 · TypeScript (strict) · expo-router · Reanimated 3 ·
`@supabase/supabase-js` · expo-av · expo-sharing.

## Project layout
```
app/                         expo-router routes
├─ _layout.tsx               providers + auth-gated routing
├─ (auth)/login | signup     email/password auth
├─ (tabs)/home | create | profile
├─ record.tsx                capture voice → presign → upload → voice profile
├─ processing/[jobId].tsx    live job status (Supabase Realtime)
└─ playback/[jobId].tsx      play + share the finished cover
src/
├─ theme/                    design tokens (colors, spacing, typography, motion)
├─ lib/                      env, supabase client, api (FastAPI) wrapper
├─ providers/AuthProvider    live auth session
├─ hooks/                    useProfile, useRealtimeJob, useNotifications, useSongs, useVoiceProfiles
├─ components/               Screen, BentoCard, GradientButton, SongCard, JobStatusBadge, ...
└─ types/db.ts               typed DB rows
```

## Everything is realtime
Auth session, profile/plan, notifications, voice profiles, and job status are all live via
Supabase Realtime — the app subscribes, it never polls.

## Setup
1. **Install deps** (run inside `apps/mobile`):
   ```bash
   npm install
   npx expo install --fix    # aligns native package versions to the Expo SDK
   ```
2. **Configure env**: copy `.env.example` → `.env` and fill in:
   - `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (Supabase project)
   - `EXPO_PUBLIC_API_BASE_URL` (the FastAPI orchestrator; needed only for record/generate)
3. **Apply the DB schema**: run [`infra/supabase/migrations/0001_init.sql`](../../infra/supabase/migrations/0001_init.sql)
   in the Supabase SQL editor, then optionally `seed.sql` for sample songs.
4. **Run**:
   ```bash
   npx expo start
   ```
   > AdMob + native share need an **EAS dev build**, not Expo Go:
   > `npx expo run:android` / `run:ios` (or `eas build --profile development`).

## What works without the backend (Supabase only)
- Sign up / log in / log out (realtime session) ✅
- Profile + plan + quota display (realtime) ✅
- Notifications feed (realtime) ✅
- Browse the song catalog ✅

## What needs the FastAPI orchestrator (`services/api`, not built yet)
- Recording → `/uploads/presign` + `/voice-profiles`
- Generating a cover → `/jobs` (quota + Runpod trigger)
- Fresh playback URLs → `/jobs/{id}`

Until the API is up, the record/generate buttons will surface an API error — auth,
profiles, notifications, and browsing all work against Supabase directly.

## Verify
- `npm run typecheck` — TypeScript compiles with no errors.
- Launch → you land on the login screen; sign up → a `profiles` row is auto-created by the
  `handle_new_user` trigger → you're routed to the Discover tab.
- Insert a row into `notifications` for your user in Supabase → it appears instantly on the
  Profile tab without refresh (proves realtime).
