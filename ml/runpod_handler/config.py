"""Single source of env truth for the worker (same rule as the API). The worker uses
presigned URLs for all IO, so no cloud credentials are read here."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Config(BaseSettings):
    log_level: str = "INFO"
    seed_vc_dir: str = "/opt/seed-vc"
    demucs_model: str = "htdemucs"
    # Selective gender conversion: only convert the user's-gender parts, keep the other
    # gender's vocal original. OFF by default — when on, cross-gender songs keep the original
    # singer's vocal, which makes the cover sound like "the usual song" instead of the user's
    # voice. Default OFF = full conversion (the user's voice throughout). Fail-safe either way.
    selective_gender: bool = False

    # Pro Voice fine-tuning (see docs/PRO_VOICE.md). Validate against the seed-vc repo.
    # Use the f0 (singing) config so a fine-tuned model matches the cover path (f0-condition).
    finetune_config: str = "configs/presets/config_dit_mel_seed_uvit_whisper_base_f0_44k.yml"
    finetune_steps: int = 500

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache(maxsize=1)
def get_config() -> Config:
    return Config()


config = get_config()
