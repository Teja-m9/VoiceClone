"""Single source of env truth for the worker (same rule as the API). The worker uses
presigned URLs for all IO, so no cloud credentials are read here."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Config(BaseSettings):
    log_level: str = "INFO"
    seed_vc_dir: str = "/opt/seed-vc"
    # htdemucs_ft = the fine-tuned, higher-quality separation model (cleaner instrumental /
    # less bleed in the background & music). Slower than plain htdemucs but better output.
    demucs_model: str = "htdemucs_ft"
    # Selective gender OFF → FULL conversion: the user's voice sings the WHOLE lead vocal,
    # every time. Selective kept producing "the original song" whenever the song's gender
    # didn't match the user's (or detection was off), which was the recurring complaint.
    # Full conversion guarantees the user's voice is always in the cover.
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
