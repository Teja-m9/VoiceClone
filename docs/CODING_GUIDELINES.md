# RealMVP — Coding Guidelines

> Mandatory engineering standards for the **RealMVP** monorepo — an AI voice-cloning & singing mobile app.
> These rules are **non-negotiable**. If a task conflicts with a rule here, follow the rule and flag the conflict.

**Stack at a glance**

| Concern | Technology |
| --- | --- |
| Backend API | FastAPI, Python 3.11+ |
| GPU worker | Python (Runpod serverless), Demucs + Seed-VC + FFmpeg |
| Mobile | React Native (Expo, TypeScript), expo-router, Reanimated |
| Data / Auth / Realtime | Supabase (Postgres + RLS + Realtime) |
| Object storage | Cloudflare R2 |
| Payments | Razorpay |
| Ads | AdMob |

---

## 1. Repository / Monorepo Structure

The repo is a single monorepo. Each deployable lives under a top-level folder. Do **not** collapse or rename these folders.

```
RealMVP/
├── apps/
│   └── mobile/                 # React Native (Expo, TypeScript) app
├── services/
│   └── api/                    # FastAPI backend (the layered layout below)
├── ml/
│   └── runpod_handler/         # GPU worker (Runpod serverless handler)
├── infra/
│   └── supabase/               # SQL migrations, RLS policies, seed data, edge fns
├── docs/                       # This file and other engineering docs
├── .github/                    # CI workflows, PR templates
├── .gitignore
├── .pre-commit-config.yaml     # repo-wide pre-commit hooks
└── README.md
```

**Rules**

- Each sub-project owns its own dependency manifest (`requirements.txt` for Python, `package.json` for mobile). No shared lockfile across languages.
- Cross-cutting docs live in `docs/`. Cross-cutting tooling config (pre-commit, CI) lives at repo root.
- `infra/supabase/` is the **single source of truth** for the DB schema, RLS, and Realtime config. No schema changes outside migrations.
- Never reach across project boundaries with relative imports (e.g. the API must not `import` from `apps/mobile`). Projects communicate over HTTP / queues only.

---

## 2. Python Backend Guidelines (`services/api/`)

### 2.1 Mandatory FastAPI layout (do not deviate)

`main.py` and `config.py` live at the **project root** (`services/api/`), **outside** `app/`.

```
services/api/
├── main.py                     # entry point — creates & runs the FastAPI app; registers routers
├── config.py                   # the ONLY place env vars are read
├── requirements.txt
├── .env                        # secrets — NEVER read this file
├── .env.example                # documents which vars exist (safe to read)
└── app/
    ├── __init__.py
    ├── api/
    │   ├── __init__.py
    │   ├── routes/             # URL → controller wiring only (thin)
    │   ├── controllers/        # validate input, call services, shape response
    │   ├── schemas/            # Pydantic request/response models (DTOs)
    │   └── services/           # business logic — the real work
    ├── client/                 # external-system clients (Supabase, R2, Razorpay, Runpod, HTTP)
    ├── constants/              # enums, status strings, prompt strings, magic numbers
    ├── helpers/                # domain-specific reusable functions
    └── utils/                  # generic, domain-agnostic utilities
```

Every package folder **must** contain `__init__.py`.

### 2.2 What goes in each layer

- **`api/routes/`** — Endpoint declarations only. Map an HTTP path + method to a controller function. No business logic, no DB/LLM/R2 calls. One router module per resource (`voices.py`, `songs.py`, `payments.py`); register them in `main.py`.
- **`api/controllers/`** — Orchestration. Parse/validate request via schemas, call the service, translate the result into a response schema, set status codes. Controllers do **not** implement business rules.
- **`api/schemas/`** — Pydantic v2 models for request bodies, query params, and responses (DTOs). No logic beyond field validators. These define the API contract.
- **`api/services/`** — All business logic. Services call clients, helpers, utils. Services take plain inputs and return plain results/domain objects — they never touch `Request`/`Response`/`Depends`.
- **`client/`** — Thin wrappers around one external system each (`supabase_client.py`, `r2_client.py`, `razorpay_client.py`, `runpod_client.py`). No business rules.
- **`constants/`** — Enums, status strings, defaults, allowed sets, magic numbers. No logic. Imports nothing from other app modules.
- **`helpers/`** — Domain-aware, stateless reusable functions (e.g. `build_voice_clone_job_payload`).
- **`utils/`** — Generic, domain-agnostic helpers (date formatting, retry wrappers, JSON helpers). Liftable into any project unchanged.

### 2.3 Dependency direction (one way only)

```
routes → controllers → services → (clients | helpers | utils | constants | schemas)
```

- Outer layers may import inner layers; never the reverse.
- `services` must NOT import from `controllers` or `routes`.
- `utils` must NOT import from `helpers`, `services`, or `clients`.
- `constants` imports nothing from other app modules.
- Anything may import `config` and `constants`.

### 2.4 Configuration — the single source of env truth

**Environment variables are read ONLY in `config.py`.** No `os.getenv` / `os.environ` anywhere else.

```python
# services/api/config.py — at project root, next to main.py
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Config(BaseSettings):
    supabase_url: str
    supabase_service_key: str
    r2_account_id: str
    r2_access_key_id: str
    r2_secret_access_key: str
    r2_bucket: str
    razorpay_key_id: str
    razorpay_key_secret: str
    runpod_api_key: str
    runpod_endpoint_id: str
    log_level: str = "INFO"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache(maxsize=1)
def get_config() -> Config:
    return Config()


config = get_config()
```

```python
# anywhere else
from config import config

key = config.razorpay_key_secret   # NEVER os.getenv("RAZORPAY_KEY_SECRET")
```

- Add every new var to `config.py` **and** `.env.example` (placeholder value, never a real secret).
- **NEVER read `.env`.** To learn which vars exist, read `config.py` or `.env.example`.

### 2.5 Naming conventions

- Modules/files: `snake_case.py`.
- Functions/variables: `snake_case`. Classes: `PascalCase`. Constants/enums values: `UPPER_SNAKE_CASE`.
- Schemas: suffix request models `...Request`, response models `...Response` (e.g. `CloneVoiceRequest`, `CloneVoiceResponse`).
- Services: `<resource>_service.py` exposing functions or a service class (`voice_service.py`).
- Routers: `<resource>.py` exposing an `APIRouter` named `router`.

### 2.6 Type hints & schemas

- **Type hints are required** on every function signature (params and return).
- All request and response bodies are Pydantic v2 models in `api/schemas/`. No raw `dict` in/out of controllers.
- Prefer explicit domain types over `Any`. Use `pydantic.BaseModel`, enums from `constants/`.

### 2.7 Error handling

- Define domain exceptions in `app/constants/` or a dedicated `app/errors.py`; raise them from services.
- Controllers translate domain exceptions into `HTTPException` with correct status codes. Services never raise `HTTPException`.
- Register an exception handler in `main.py` for uncaught domain errors → consistent JSON error envelope:

```python
{"error": {"code": "VOICE_NOT_FOUND", "message": "..."}}
```

- Never swallow exceptions silently. Never leak stack traces or secrets in responses.

### 2.8 Logging

- Use the stdlib `logging` module configured once in `main.py`; level from `config.log_level`.
- Structured, context-rich logs: include `request_id`, `user_id`, `job_id` where available. No f-string secrets.
- Log at boundaries (incoming request, external client call, job dispatch). Do **not** `print()`.

### 2.9 Dependency injection

- Use FastAPI `Depends` for cross-cutting concerns (auth/current user, client instances, pagination).
- Provide clients via dependency functions so they can be overridden in tests:

```python
# app/api/routes/voices.py
from fastapi import APIRouter, Depends
from app.api.controllers import voice_controller
from app.api.schemas.voice import CloneVoiceRequest, CloneVoiceResponse
from app.client.supabase_client import get_supabase

router = APIRouter(prefix="/voices", tags=["voices"])


@router.post("", response_model=CloneVoiceResponse, status_code=201)
async def clone_voice(
    payload: CloneVoiceRequest,
    supabase=Depends(get_supabase),
) -> CloneVoiceResponse:
    return await voice_controller.clone_voice(payload, supabase)
```

- `Depends` wiring stays in routes/controllers. Services receive already-resolved dependencies as plain arguments.

### 2.10 Async conventions

- The API is async-first. Route handlers, controllers, and services are `async def`.
- Never block the event loop: no synchronous network/disk in async paths. Wrap unavoidable blocking calls in `run_in_threadpool`.
- External clients expose `async` methods; long-running ML work is dispatched to the Runpod worker, not awaited inline.

### 2.11 Testing (pytest)

```
services/api/
└── tests/
    ├── __init__.py
    ├── conftest.py             # fixtures: test client, mocked external clients
    ├── unit/                   # services, helpers, utils — pure logic
    └── integration/            # route-level via httpx.AsyncClient + TestClient
```

- One test module per source module (`test_voice_service.py`).
- Mock all external clients (Supabase, R2, Razorpay, Runpod) — no real network in tests.
- Override `Depends` with fixtures. Cover happy path + each error branch. Target meaningful coverage on `services/`.

---

## 3. GPU Worker Guidelines (`ml/runpod_handler/`)

The worker runs the Demucs → Seed-VC → FFmpeg pipeline as a Runpod serverless handler.

```
ml/runpod_handler/
├── handler.py                  # Runpod entry: validates job input, runs pipeline, returns result
├── config.py                   # ONLY place env vars are read (same rule as the API)
├── requirements.txt
├── .env.example
└── pipeline/
    ├── __init__.py
    ├── separate.py             # Demucs stem separation — pure function
    ├── convert.py              # Seed-VC voice conversion — pure function
    ├── mix.py                  # FFmpeg remux/mix — pure function
    └── io.py                   # R2 download/upload helpers
```

**Rules**

- **Pure functions per stage.** Each stage takes explicit inputs (file paths, params) and returns outputs; no hidden global state. The handler composes them.
- **Idempotency.** A job keyed by `job_id` may run more than once (retries). Use deterministic output paths and overwrite-safe writes; check whether the output already exists before recomputing. Side effects (DB status updates) must be safe to repeat.
- **Structured logging.** Log `job_id`, stage name, and timing for each stage; log failures with the failing stage. No `print()`.
- **No secrets in code.** R2/Supabase credentials come from `config.py` (env), never hardcoded. Never log credentials or signed URLs in full.
- **Clean up.** Remove temp files in a `finally` block; never assume the container is fresh.
- **Fail loud, fail typed.** Raise a clear exception with the stage that failed so the API can mark the job `failed` with a useful reason.

---

## 4. React Native / TypeScript Guidelines (`apps/mobile/`)

### 4.1 Folder structure

```
apps/mobile/
├── app/                        # expo-router file-based routes ONLY
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── (auth)/
│   │   ├── sign-in.tsx
│   │   └── sign-up.tsx
│   └── (tabs)/
│       ├── _layout.tsx
│       ├── library.tsx
│       └── create.tsx
├── src/
│   ├── components/             # reusable UI (PascalCase folders/files)
│   ├── features/               # feature-scoped components + logic
│   ├── hooks/                  # data-access & logic hooks (useXxx)
│   ├── lib/                    # client setup (supabase, api client)
│   ├── theme/                  # design tokens (single source)
│   ├── constants/              # enums, route names, magic values
│   ├── types/                  # shared TS types
│   └── utils/                  # generic helpers
├── app.config.ts               # env + Expo config (NOT hardcoded values)
├── tsconfig.json
└── package.json
```

### 4.2 expo-router conventions

- `app/` contains **routes only** — screens that map to URLs. Keep them thin: compose feature components and call hooks.
- Use route groups `(group)` for layout grouping without affecting the URL.
- `_layout.tsx` defines navigators (Stack/Tabs). Shared providers (theme, query client, auth) wrap the root `_layout.tsx`.
- No business logic or direct Supabase calls inside route files — delegate to hooks/features.

### 4.3 Naming

- Components: `PascalCase` files and exports (`VoiceCard.tsx` → `VoiceCard`).
- Hooks: `camelCase` with `use` prefix (`useVoiceLibrary.ts` → `useVoiceLibrary`).
- Route files: follow expo-router lowercase/kebab conventions (`sign-in.tsx`).
- Types/interfaces: `PascalCase`. Constants: `UPPER_SNAKE_CASE`.

### 4.4 Strict TypeScript

- `tsconfig.json` runs in `strict` mode. **`any` is banned** — use `unknown` + narrowing, generics, or precise types.
- No non-null `!` assertions to bypass the type checker; handle null/undefined explicitly.
- Type every prop with an explicit `Props` type; no implicit `any` props.
- Share API contract types in `src/types/`; mirror backend Pydantic schemas where practical.

### 4.5 Theme / design tokens

A single `src/theme/` module is the only source of colors, spacing, typography, and radii. No hardcoded hex/px scattered in components.

```ts
// src/theme/tokens.ts
export const colors = {
  bg: "#0B0B0F",
  surface: "#15151D",
  primary: "#7C5CFF",
  text: "#FFFFFF",
  textMuted: "#9A9AB0",
  danger: "#FF4D6D",
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const typography = {
  title: { fontSize: 24, fontWeight: "700" },
  body: { fontSize: 16, fontWeight: "400" },
} as const;
```

Components import tokens (`import { colors, spacing } from "@/theme/tokens"`). Reviewers reject raw `#hex`/magic numbers in component styles.

### 4.6 Data access via hooks

- **No inline Supabase/API calls inside components.** All data access lives in `src/hooks/`.
- The Supabase client is created once in `src/lib/supabase.ts` and reused.

```ts
// src/hooks/useVoiceLibrary.ts
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Voice } from "@/types/voice";

export function useVoiceLibrary() {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase
      .from("voices")
      .select("*")
      .then(({ data }) => {
        if (active) {
          setVoices((data as Voice[]) ?? []);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return { voices, loading };
}
```

Components consume `const { voices, loading } = useVoiceLibrary();` and render — they never touch `supabase` directly.

### 4.7 State management

- **Server state:** prefer a query library (TanStack Query) or Supabase Realtime subscriptions wrapped in hooks. Do not hand-roll fetch caching in components.
- **Local UI state:** `useState`/`useReducer` colocated in the component.
- **Global app state** (auth/session, current user): a single React Context provider in `src/lib/` mounted at the root layout. Avoid prop drilling and avoid a global store for data that belongs to the server cache.

### 4.8 Reanimated conventions

- Use Reanimated 3 worklets (`useSharedValue`, `useAnimatedStyle`, `withTiming`/`withSpring`). No `Animated` from `react-native` for new code.
- Keep animation logic in hooks (`useFadeIn`) or colocated with the component; share durations/easing via theme constants.
- Drive animations on the UI thread; never read/write shared values from the JS thread in a render loop.

### 4.9 Accessibility

- Every interactive element has `accessibilityRole` and `accessibilityLabel`.
- Respect `prefers-reduced-motion` — gate non-essential animations.
- Minimum 44×44 pt touch targets; sufficient color contrast against `colors.bg`.
- Audio playback controls expose state via accessibility labels (playing/paused).

### 4.10 Environment / config

- Env values come from `app.config.ts` via `expo-constants` (`extra`) — **never hardcoded** in source.
- Public-safe values only on the client (e.g. Supabase anon key, API base URL). Service keys/secrets never ship in the app.

```ts
// app.config.ts
export default {
  expo: {
    extra: {
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    },
  },
};
```

---

## 5. Shared Conventions

### 5.1 Git commit messages (Conventional Commits)

```
<type>(<scope>): <short imperative summary>
```

- Types: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `perf`, `ci`, `build`.
- Scopes: `api`, `mobile`, `ml`, `infra`, `docs` (or a feature name).
- Example: `feat(api): add voice clone dispatch endpoint`
- Keep the summary ≤ 72 chars, imperative mood. Body explains *why*, not *what*.

### 5.2 Branch naming

```
<type>/<short-kebab-description>
```

Examples: `feat/voice-clone-endpoint`, `fix/r2-upload-retry`, `chore/pre-commit-setup`. No work directly on `main`; PRs only.

### 5.3 Formatting & linting

- **Python:** `black` (formatting) + `ruff` (lint + import sort). CI fails on violations.
- **TypeScript:** `prettier` (formatting) + `eslint` (with `@typescript-eslint`, no-`any` rule on). CI fails on violations.
- Run formatters before commit; do not mix formatting-only changes with logic changes in the same commit.

### 5.4 Pre-commit

A repo-root `.pre-commit-config.yaml` runs: `ruff`, `black`, `prettier`, `eslint`, trailing-whitespace/EOF fixers, and a secret scanner. PRs must pass the same checks in CI.

### 5.5 Secrets management

- **Never commit secrets.** `.env` files are git-ignored. Each project ships a `.env.example` with placeholder values documenting required vars.
- Backend & worker read env only via their respective `config.py`. Mobile reads only public-safe values via `app.config.ts`.
- Service keys (Supabase service key, R2 secret, Razorpay secret) live only on the server/worker — never in the mobile bundle.
- Rotate any credential that lands in git history; do not just delete it.

### 5.6 File / folder naming

- Python: `snake_case` files and folders.
- TypeScript components: `PascalCase` files; hooks/utils: `camelCase` files; route files follow expo-router conventions.
- One primary export per file where reasonable; folder name matches its main export for components.

### 5.7 Comment density

- Comment **why**, not **what** — the code already says what. No commented-out code in commits.
- Public functions/services get a short docstring (Python) or JSDoc (TS) describing intent, inputs, and side effects.
- Prefer self-documenting names over comments. Mark intentional exceptions with `# NOTE:` / `// NOTE:` and a reason.

---

## 6. Definition of Done

A change is **done** only when all of the following are true:

- [ ] Code is placed in the correct layer/folder per this document (no business logic in routes/controllers; no inline data calls in RN components).
- [ ] No `os.getenv`/`os.environ` outside `config.py`; no hardcoded env values in mobile; `.env` never read or committed.
- [ ] New env vars added to `config.py`/`app.config.ts` **and** the relevant `.env.example`.
- [ ] Full type hints (Python) / strict types with no `any` (TS).
- [ ] All request/response bodies are Pydantic schemas (API); shared TS types defined for API contracts (mobile).
- [ ] Errors handled at the right layer; structured logging added at boundaries; no secrets in logs.
- [ ] GPU pipeline stages remain pure and idempotent (if touched).
- [ ] Tests added/updated and passing (`pytest` for Python); external clients mocked.
- [ ] `black` + `ruff` (Python) and `prettier` + `eslint` (TS) pass; pre-commit clean.
- [ ] Accessibility props present on new interactive UI; animations respect reduced-motion.
- [ ] Conventional-commit messages on a correctly named branch; PR green in CI.
- [ ] Docs/`.env.example` updated when behavior or config changed.
