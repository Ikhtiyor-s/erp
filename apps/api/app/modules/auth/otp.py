"""Registration OTP helpers — phone verification before an org/user exists.

Flow: request-otp -> verify-otp (issues a short-lived "register ticket") ->
register (consumes the ticket, no need to re-check the OTP code).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from jose import jwt

from app.core.config import settings
from app.core.security import decode_token


REGISTER_TICKET_TYPE = "register_ticket"
REGISTER_TICKET_EXPIRE_MINUTES = 15


def create_register_ticket(phone: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": phone,
        "type": REGISTER_TICKET_TYPE,
        "iat": now,
        "exp": now + timedelta(minutes=REGISTER_TICKET_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_register_ticket(token: str) -> str | None:
    """Return the verified phone number, or None if the ticket is invalid/expired/wrong type."""
    try:
        payload = decode_token(token)
    except ValueError:
        return None
    if payload.get("type") != REGISTER_TICKET_TYPE:
        return None
    return payload.get("sub")
