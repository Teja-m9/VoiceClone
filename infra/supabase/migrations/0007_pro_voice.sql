-- 0007 — Pro Voice: high-fidelity, fine-tuned clones (Phase 2 premium feature).
-- A voice profile can be upgraded from the default zero-shot clone to a fine-tuned "Pro"
-- model trained on the user's own voice. Training runs on the GPU worker (mode=train); the
-- resulting checkpoint is stored in S3 and referenced here. Training STATE lives on the
-- voice profile (already realtime), so cover orchestration / the jobs table are untouched.

alter table public.voice_profiles
  add column if not exists tier text not null default 'zero_shot'
    check (tier in ('zero_shot', 'pro')),
  add column if not exists training_status text not null default 'none'
    check (training_status in ('none', 'training', 'ready', 'failed')),
  add column if not exists model_key text,          -- S3 key of the fine-tuned checkpoint
  add column if not exists model_config_key text;   -- S3 key of its config yaml (if any)
