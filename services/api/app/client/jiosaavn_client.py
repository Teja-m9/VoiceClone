"""JioSaavn client — resolves a song's streamable URL server-side so the GPU worker can
download the track. Mirrors the mobile client's mapping (highest-quality downloadUrl)."""
from functools import lru_cache

import httpx

from config import config


class JioSaavnClient:
    def __init__(self) -> None:
        self._base = config.saavn_api_url

    async def resolve_stream_url(self, song_id: str) -> str | None:
        """Return the highest-quality download/stream URL for a song id, or None."""
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                res = await client.get(f"{self._base}/api/songs/{song_id}")
                res.raise_for_status()
                payload = res.json()
        except httpx.HTTPError:
            return None
        data = payload.get("data")
        song = data[0] if isinstance(data, list) and data else data
        if not isinstance(song, dict):
            return None
        urls = song.get("downloadUrl") or []
        if not urls:
            return None
        last = urls[-1]
        return last.get("url") or last.get("link")


@lru_cache(maxsize=1)
def get_jiosaavn() -> JioSaavnClient:
    return JioSaavnClient()
