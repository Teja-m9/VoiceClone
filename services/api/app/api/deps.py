"""FastAPI dependencies: auth (verify Supabase JWT → Principal) and client providers.
Depends wiring lives here / in routes; services receive resolved values as plain args."""
from dataclasses import dataclass

import jwt
from fastapi import Depends, Header

from app.errors import UnauthorizedError
from config import config


@dataclass(frozen=True)
class Principal:
    """The authenticated caller, derived from a verified Supabase JWT."""

    user_id: str


def _verify_token(token: str) -> Principal:
    try:
        payload = jwt.decode(
            token,
            config.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.PyJWTError as exc:
        raise UnauthorizedError("Invalid or expired token") from exc
    sub = payload.get("sub")
    if not sub:
        raise UnauthorizedError("Token missing subject")
    return Principal(user_id=sub)


async def current_principal(authorization: str = Header(default="")) -> Principal:
    """Auth dependency for protected routes. Expects `Authorization: Bearer <jwt>`."""
    if not authorization.lower().startswith("bearer "):
        raise UnauthorizedError("Missing bearer token")
    return _verify_token(authorization[7:].strip())


# Re-export client providers so routes import dependencies from one place.
from app.client.jiosaavn_client import get_jiosaavn  # noqa: E402,F401
from app.client.runpod_client import get_runpod  # noqa: E402,F401
from app.client.s3_client import get_s3  # noqa: E402,F401
from app.client.supabase_client import get_supabase  # noqa: E402,F401

__all__ = [
    "Principal",
    "current_principal",
    "get_jiosaavn",
    "get_runpod",
    "get_s3",
    "get_supabase",
    "Depends",
]
