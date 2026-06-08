"""Admin accounts get unlimited, premium-level access (no quota, no watermark, full song).
Mirrors apps/mobile/src/lib/admin.ts. Matched by email allowlist."""

ADMIN_EMAILS = {"ramtejaramteja9322@gmail.com"}


def is_admin_email(email: str | None) -> bool:
    return bool(email) and email.strip().lower() in ADMIN_EMAILS
