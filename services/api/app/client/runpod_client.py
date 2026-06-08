"""Runpod Serverless client — triggers the GPU clone pipeline. Thin wrapper; the job
payload is built by a helper, not here."""
from functools import lru_cache
from typing import Any

import httpx

from app.errors import UpstreamError
from config import config


class RunpodClient:
    def __init__(self) -> None:
        self._url = f"https://api.runpod.ai/v2/{config.runpod_endpoint_id}/run"
        self._headers = {
            "Authorization": f"Bearer {config.runpod_api_key}",
            "Content-Type": "application/json",
        }

    async def trigger(self, job_input: dict[str, Any], webhook_url: str) -> str:
        """POST the job to Runpod. Returns Runpod's async job id."""
        body = {"input": job_input, "webhook": webhook_url}
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                res = await client.post(self._url, headers=self._headers, json=body)
                res.raise_for_status()
                data = res.json()
        except httpx.HTTPError as exc:
            raise UpstreamError(f"Runpod trigger failed: {exc}") from exc
        runpod_id = data.get("id")
        if not runpod_id:
            raise UpstreamError("Runpod did not return a job id")
        return runpod_id


@lru_cache(maxsize=1)
def get_runpod() -> RunpodClient:
    return RunpodClient()
