import os
import time
import logging
import httpx
from typing import Optional
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .database import get_session
from .models import Config
from sqlmodel import select

logger = logging.getLogger(__name__)

_token_cache: dict[str, tuple[float, dict]] = {}
_CACHE_TTL_SECONDS = 300

_bearer_scheme = HTTPBearer(auto_error=False)


def _is_auth_enabled() -> bool:
    env_val = os.environ.get("AUTH_ENABLED")
    if env_val is not None:
        return env_val.lower() not in ("false", "0", "no")
    with get_session() as session:
        stmt = select(Config).where(Config.key == "auth_enabled")
        cfg = session.exec(stmt).first()
        if cfg:
            return cfg.value.lower() not in ("false", "0", "no")
    return False


async def _get_paperless_url() -> str:
    with get_session() as session:
        stmt = select(Config).where(Config.key == "paperless_url")
        cfg = session.exec(stmt).first()
        if cfg and cfg.value:
            return cfg.value
    return os.environ.get("PAPERLESS_URL", "")


async def _verify_token_against_paperless(token: str) -> dict:
    now = time.time()
    cached = _token_cache.get(token)
    if cached and (now - cached[0]) < _CACHE_TTL_SECONDS:
        return cached[1]

    paperless_url = await _get_paperless_url()
    if not paperless_url:
        if cached:
            logger.warning("Paperless URL not configured; serving stale auth cache")
            return cached[1]
        raise HTTPException(status_code=503, detail="Paperless not configured")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{paperless_url}/api/tags/?page_size=1",
                headers={"Authorization": f"Token {token}"},
            )
        if response.status_code in (401, 403):
            _token_cache.pop(token, None)
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        response.raise_for_status()
        user_info = {"token": token}
        _token_cache[token] = (now, user_info)
        return user_info
    except HTTPException:
        raise
    except (httpx.ConnectError, httpx.TimeoutException, Exception) as exc:
        if cached:
            logger.warning(f"Paperless unreachable ({exc}); serving stale auth cache")
            return cached[1]
        raise HTTPException(status_code=503, detail="Paperless is unreachable and no cached session exists")


async def require_auth(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> dict:
    if not _is_auth_enabled():
        return {}
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Authentication required")
    return await _verify_token_against_paperless(credentials.credentials)
