"""Single source of environment truth. Per coding guidelines, env vars are read ONLY
here — no os.getenv/os.environ anywhere else in the codebase."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Config(BaseSettings):
    # Supabase
    supabase_url: str
    supabase_service_key: str
    supabase_jwt_secret: str

    # AWS S3 (audio storage)
    aws_access_key_id: str
    aws_secret_access_key: str
    aws_region: str = "ap-south-1"
    s3_bucket: str
    s3_endpoint_url: str | None = None  # blank for AWS; set for S3-compatible providers

    # Runpod
    runpod_api_key: str
    runpod_endpoint_id: str
    runpod_webhook_secret: str

    # JioSaavn
    saavn_api_url: str = "https://saavn.sumit.co"

    # Misc
    api_base_url: str = "http://localhost:8000"
    free_daily_quota: int = 3
    presign_put_ttl: int = 600
    presign_get_ttl: int = 3600
    max_upload_bytes: int = 25 * 1024 * 1024
    log_level: str = "INFO"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache(maxsize=1)
def get_config() -> Config:
    return Config()


config = get_config()
