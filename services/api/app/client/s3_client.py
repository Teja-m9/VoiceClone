"""S3 client — presigned PUT/GET for audio storage and an existence check.

Presigning is local (no network), so those methods are sync. The existence check does a
network HEAD, so it's exposed as async via run_in_threadpool to avoid blocking the loop.
Works with AWS S3 or any S3-compatible endpoint (set S3_ENDPOINT_URL)."""
from functools import lru_cache

import boto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError
from fastapi.concurrency import run_in_threadpool

from config import config


class S3Client:
    def __init__(self) -> None:
        self._bucket = config.s3_bucket
        self._s3 = boto3.client(
            "s3",
            region_name=config.aws_region,
            aws_access_key_id=config.aws_access_key_id,
            aws_secret_access_key=config.aws_secret_access_key,
            endpoint_url=config.s3_endpoint_url or None,
            config=BotoConfig(signature_version="s3v4"),
        )

    def presign_put(self, key: str, content_type: str, ttl: int) -> str:
        """Presigned PUT URL for a single object + content type."""
        return self._s3.generate_presigned_url(
            "put_object",
            Params={"Bucket": self._bucket, "Key": key, "ContentType": content_type},
            ExpiresIn=ttl,
        )

    def presign_get(self, key: str, ttl: int) -> str:
        """Presigned GET URL for playback/sharing/worker download."""
        return self._s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": self._bucket, "Key": key},
            ExpiresIn=ttl,
        )

    async def exists(self, key: str) -> bool:
        """HEAD the object to confirm an upload landed before recording it in the DB."""

        def _head() -> bool:
            try:
                self._s3.head_object(Bucket=self._bucket, Key=key)
                return True
            except ClientError:
                return False

        return await run_in_threadpool(_head)


@lru_cache(maxsize=1)
def get_s3() -> S3Client:
    return S3Client()
