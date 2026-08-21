"""Eskiz.uz SMS provider client.

API docs: https://documenter.getpostman.com/view/663428/RzfmES4z

Auth: POST /auth/login → JWT (valid ~30 days)
Send: POST /message/sms/send → form-encoded {mobile_phone, message, from, callback_url?}
"""
import asyncio
import hashlib
import logging
import time

import httpx


log = logging.getLogger(__name__)

ESKIZ_BASE_URL = "https://notify.eskiz.uz/api"

# In-process token cache: {creds_hash: (token, expires_at_ts)}
# H10: cache key is sha256(email:password) — never store plain password in
# process memory as a dict key (visible in core dumps / heap snapshots).
# Production with multiple workers should use Redis with the same hashed key.
_token_cache: dict[str, tuple[str, float]] = {}
_token_lock = asyncio.Lock()


def _creds_hash(email: str, password: str) -> str:
    return hashlib.sha256(f"{email}:{password}".encode("utf-8")).hexdigest()


async def _login(email: str, password: str) -> str:
    """Get JWT token from Eskiz. Cached per hashed (email, password)."""
    key = _creds_hash(email, password)
    now = time.time()
    cached = _token_cache.get(key)
    if cached and cached[1] > now:
        return cached[0]

    async with _token_lock:
        # Double-check after acquiring lock
        cached = _token_cache.get(key)
        if cached and cached[1] > now:
            return cached[0]

        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(
                f"{ESKIZ_BASE_URL}/auth/login",
                data={"email": email, "password": password},
            )
            r.raise_for_status()
            payload = r.json()
            token = payload.get("data", {}).get("token")
            if not token:
                raise RuntimeError(f"Eskiz login failed: {payload}")
            # Cache for 24 hours (token actually lasts 30 days; we refresh sooner)
            _token_cache[key] = (token, now + 24 * 3600)
            return token


def _normalize_phone(phone: str) -> str:
    """Eskiz expects digits only, e.g. '998901234567'."""
    digits = "".join(c for c in phone if c.isdigit())
    if digits.startswith("8") and len(digits) == 12:
        # Some clients prefix 8 instead of 998
        digits = "998" + digits[1:]
    elif len(digits) == 9:
        # Local format — assume Uzbekistan
        digits = "998" + digits
    return digits


async def send_sms(
    email: str,
    password: str,
    phone: str,
    message: str,
    sender: str = "4546",
) -> dict:
    """Send an SMS via Eskiz.

    Args:
        email, password: Eskiz account credentials (cached for token reuse)
        phone: recipient phone (any format — will be normalized to E.164 digits)
        message: text body
        sender: Eskiz sender ID (default '4546' is the test sender for unmoderated accounts)

    Returns:
        Eskiz API response dict.

    Raises:
        httpx.HTTPStatusError on API failure.
        RuntimeError on auth failure.
    """
    token = await _login(email, password)
    target = _normalize_phone(phone)

    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(
            f"{ESKIZ_BASE_URL}/message/sms/send",
            headers={"Authorization": f"Bearer {token}"},
            data={
                "mobile_phone": target,
                "message": message,
                "from": sender,
            },
        )
        # If token expired (401), clear cache and retry once
        if r.status_code == 401:
            async with _token_lock:
                _token_cache.pop(_creds_hash(email, password), None)
            token = await _login(email, password)
            r = await client.post(
                f"{ESKIZ_BASE_URL}/message/sms/send",
                headers={"Authorization": f"Bearer {token}"},
                data={
                    "mobile_phone": target,
                    "message": message,
                    "from": sender,
                },
            )
        r.raise_for_status()
        return r.json()
