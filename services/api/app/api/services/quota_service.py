"""Free-tier quota enforcement via the atomic Postgres reserve_quota/release_quota RPCs
(row-locked, race-safe). Premium bypasses (returns unlimited)."""
from dataclasses import dataclass

from app.client.supabase_client import SupabaseClient
from config import config


@dataclass(frozen=True)
class QuotaResult:
    allowed: bool
    remaining: int   # -1 == unlimited (premium with no explicit allowance)
    premium: bool    # the user's plan, so callers don't need a second lookup


async def reserve(supabase: SupabaseClient, user_id: str) -> QuotaResult:
    """Atomically reserve one cover. Free → daily cap; premium → per-period allowance."""
    rows = await supabase.rpc(
        "reserve_quota", {"p_user": user_id, "p_limit": config.free_daily_quota}
    )
    row = rows[0] if isinstance(rows, list) and rows else rows
    return QuotaResult(
        allowed=bool(row["allowed"]),
        remaining=int(row["remaining"]),
        premium=bool(row.get("premium", False)),
    )


async def release(supabase: SupabaseClient, user_id: str) -> None:
    """Refund a reservation when a job ultimately fails."""
    await supabase.rpc("release_quota", {"p_user": user_id})
