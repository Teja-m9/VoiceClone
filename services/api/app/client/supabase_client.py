"""Supabase data client over PostgREST using the service-role key (bypasses RLS for
privileged server writes: jobs, notifications, quota RPC). Thin wrapper — no business
rules. All calls are async via httpx."""
from functools import lru_cache
from typing import Any

import httpx

from config import config


class SupabaseClient:
    def __init__(self) -> None:
        self._base = f"{config.supabase_url}/rest/v1"
        self._headers = {
            "apikey": config.supabase_service_key,
            "Authorization": f"Bearer {config.supabase_service_key}",
            "Content-Type": "application/json",
        }

    async def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.request(method, f"{self._base}{path}", headers=self._headers, **kwargs)
            res.raise_for_status()
            if res.status_code == 204 or not res.content:
                return None
            return res.json()

    async def select_one(self, table: str, filters: dict[str, str], columns: str = "*") -> dict | None:
        params = {"select": columns, "limit": "1", **{k: f"eq.{v}" for k, v in filters.items()}}
        rows = await self._request("GET", f"/{table}", params=params)
        return rows[0] if rows else None

    async def insert(self, table: str, row: dict[str, Any]) -> dict:
        headers = {**self._headers, "Prefer": "return=representation"}
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.post(f"{self._base}/{table}", headers=headers, json=row)
            res.raise_for_status()
            data = res.json()
            return data[0] if isinstance(data, list) else data

    async def update(self, table: str, filters: dict[str, str], patch: dict[str, Any]) -> None:
        params = {k: f"eq.{v}" for k, v in filters.items()}
        await self._request("PATCH", f"/{table}", params=params, json=patch)

    async def create_signed_url(self, bucket: str, path: str, expires_in: int) -> str | None:
        """Create a time-limited signed URL for a private Storage object (e.g. a voice clip),
        so the GPU worker can download it without credentials."""
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.post(
                f"{config.supabase_url}/storage/v1/object/sign/{bucket}/{path}",
                headers=self._headers,
                json={"expiresIn": expires_in},
            )
            if res.status_code >= 300:
                return None
            signed = res.json().get("signedURL")
            return f"{config.supabase_url}/storage/v1{signed}" if signed else None

    async def rpc(self, fn: str, args: dict[str, Any]) -> Any:
        """Call a Postgres function (e.g. reserve_quota / release_quota)."""
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.post(f"{self._base}/rpc/{fn}", headers=self._headers, json=args)
            res.raise_for_status()
            return res.json()


@lru_cache(maxsize=1)
def get_supabase() -> SupabaseClient:
    return SupabaseClient()
