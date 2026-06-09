"""Single source of environment truth. Per coding guidelines, env vars are read ONLY
here — no os.getenv/os.environ anywhere else in the codebase."""
from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Config(BaseSettings):
    # Supabase
    supabase_url: str = ""
    supabase_service_key: str = ""
    supabase_jwt_secret: str = ""

    # AWS S3 (audio storage) — accepts either AWS_* or S3_* env naming.
    aws_access_key_id: str = Field(
        default="", validation_alias=AliasChoices("AWS_ACCESS_KEY_ID", "S3_ACCESS_KEY")
    )
    aws_secret_access_key: str = Field(
        default="", validation_alias=AliasChoices("AWS_SECRET_ACCESS_KEY", "S3_SECRET_KEY")
    )
    aws_region: str = Field(
        default="ap-south-1", validation_alias=AliasChoices("AWS_REGION", "S3_REGION")
    )
    s3_bucket: str = Field(
        default="", validation_alias=AliasChoices("S3_BUCKET", "AWS_S3_BUCKET")
    )
    s3_endpoint_url: str | None = None  # blank for AWS; set for S3-compatible providers

    # Runpod
    runpod_api_key: str = ""
    runpod_endpoint_id: str = ""
    runpod_webhook_secret: str = ""

    # JioSaavn
    saavn_api_url: str = "https://saavn.sumit.co"

    # Stripe billing (optional until you wire payments)
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_monthly: str = ""
    stripe_price_quarterly: str = ""
    billing_success_url: str = "realmvp://billing/success"
    billing_cancel_url: str = "realmvp://billing/cancel"

    # Misc
    api_base_url: str = "http://localhost:8000"
    free_daily_quota: int = 3
    premium_monthly_quota: int = 20      # songs per period on the monthly plan
    premium_quarterly_quota: int = 100   # songs per period on the 3-month plan
    presign_put_ttl: int = 600
    presign_get_ttl: int = 3600
    max_upload_bytes: int = 25 * 1024 * 1024
    log_level: str = "INFO"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache(maxsize=1)
def get_config() -> Config:
    return Config()


config = get_config()
