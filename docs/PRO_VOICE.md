# Pro Voice — high-fidelity fine-tuned cloning (Phase 2)

The default clone is **zero-shot** (Seed-VC, instant, from a few seconds of audio). It's a
convincing cover but can leave a trace of the original singer's timbre on hard songs.

**Pro Voice** fine-tunes a model on the user's own voice so the clone is **near
indistinguishable** — at the cost of a one-time training run (minutes of GPU) per voice.
It's a **premium** feature (a clear reason to upgrade).

## Why Seed-VC fine-tune (not RVC)
- Seed-VC is **already installed** in the worker image (`/opt/seed-vc`, ships `train.py`).
  An RVC path would mean a new repo + HuBERT/RMVPE weights + a Docker rewrite — high risk to
  the working pipeline. Fine-tuning Seed-VC reuses everything we already build and run.
- Inference is unchanged except for one flag: `inference.py --checkpoint <user_ckpt>`.

## Data model (✅ migration `0007_pro_voice.sql`)
`voice_profiles` gains:
| column | meaning |
|---|---|
| `tier` | `zero_shot` (default) \| `pro` |
| `training_status` | `none` \| `training` \| `ready` \| `failed` |
| `model_key` | S3 key of the fine-tuned checkpoint |
| `model_config_key` | S3 key of its config yaml (if any) |

Training state lives on `voice_profiles` (already realtime via `useVoiceProfiles`) — **no new
jobs table changes**, so cover orchestration is untouched.

## Flow
```
1. User records a longer, clean sample (40–90s) → uploads (existing voice flow).
2. User taps "Upgrade to Pro Voice" (premium) → API:
     - set voice_profiles.training_status = 'training'
     - presign S3 PUT for the checkpoint
     - trigger Runpod with { mode: "train", voice_ref_url, model_put_url, ... }
3. Worker (mode=train): clean ref → seed-vc train.py fine-tune → upload checkpoint → webhook.
4. Webhook: set training_status='ready', tier='pro', model_key=<key>.
5. Future covers with this voice → API presigns model_get_url → Runpod cover gets
     { inputs.model_url } → convert.py runs inference with --checkpoint → high-fidelity clone.
```

## Components
- **GPU (✅ scaffolded, needs validation):**
  - `pipeline/finetune.py` — `finetune_voice(voice_ref, run_name, workdir) → checkpoint`.
  - `handler.py` — branches on `mode`: `"train"` fine-tunes & uploads a checkpoint; `"cover"`
    (default) is unchanged, except it now uses `--checkpoint` when a `model_url` is supplied.
  - `convert.py` — `convert_voice(..., checkpoint=None)`; appends `--checkpoint`/`--config`
    when a Pro model is provided. **Zero-shot path is byte-for-byte unchanged.**
- **API (TODO):** `POST /voice-profiles/{id}/train` (premium-gated) → set status, presign,
  trigger Runpod train. Extend the Runpod webhook to finalize training. Add `model_url` to the
  cover payload when the chosen voice is `tier='pro' & status='ready'`.
- **Mobile (TODO):** a "⚡ Upgrade to Pro Voice" action on a voice (premium); show
  `training_status` live (training → ready) via the existing `useVoiceProfiles` realtime hook;
  a "PRO" badge on Pro voices.

## Remaining heavy lift (to actually run a training job)
1. **Validate `train.py` flags** against the pinned Seed-VC commit (its CLI varies). The args
   in `finetune.py` are the intended shape and **must be confirmed** on the box.
2. **Dockerfile**: training may need the base model checkpoints + a training config the repo
   downloads on first run; pre-bake them so cold training doesn't re-download every time.
3. **GPU endpoint**: training needs more time/VRAM than inference. Either raise the serverless
   execution-time limit on the existing endpoint, or use a separate `train` endpoint.
4. Wire the API endpoint + webhook branch + mobile UI per above.

## Cost / UX
- One-time training: a few minutes of GPU per voice (cents). Charge as a premium one-off or
  bundle into the subscription.
- Inference cost is unchanged. Pro covers are the same latency as zero-shot.
