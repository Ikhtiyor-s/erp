"""
Customer portal authentication — OTP-based (SMS).

Flow:
1. Customer enters phone → POST /customer-portal/auth/request-otp
   Server generates 6-digit code, stores in customer_otp_codes (15 min expiry),
   sends via SMS provider (or logs to console if none configured).
2. Customer enters code → POST /customer-portal/auth/verify
   Server verifies code, issues JWT signed with separate secret.
3. Subsequent requests include `Authorization: Bearer <customer_jwt>`.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Depends, HTTPException, Request, status
from jose import JWTError, jwt
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_db
from app.core.phone import normalize_phone as _normalize_phone, generate_otp


log = logging.getLogger(__name__)


# Use a derived secret so customer tokens can't be used for admin endpoints
CUSTOMER_JWT_SECRET = f"customer:{settings.SECRET_KEY}"
CUSTOMER_JWT_ALGO = "HS256"
CUSTOMER_JWT_EXPIRES_MINUTES = 60 * 24 * 30  # 30 days


def create_customer_token(customer_id: str, org_id: str, phone: str) -> str:
    payload = {
        "sub": customer_id,
        "org": org_id,
        "phone": phone,
        "kind": "customer",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=CUSTOMER_JWT_EXPIRES_MINUTES),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, CUSTOMER_JWT_SECRET, algorithm=CUSTOMER_JWT_ALGO)


def decode_customer_token(token: str) -> dict[str, Any] | None:
    try:
        payload = jwt.decode(token, CUSTOMER_JWT_SECRET, algorithms=[CUSTOMER_JWT_ALGO])
        if payload.get("kind") != "customer":
            return None
        return payload
    except JWTError:
        return None


async def get_current_customer(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """FastAPI dependency: return current customer info or raise 401."""
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token kerak")
    token = auth.split(" ", 1)[1].strip()
    payload = decode_customer_token(token)
    if not payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token noto'g'ri")

    customer_id = payload["sub"]
    org_id = payload["org"]

    # Verify customer still exists and is active
    res = await db.execute(
        text("""
            SELECT id, name, phone, address, tin, email, is_active, organization_id
            FROM customers
            WHERE id = :id AND organization_id = :o
        """),
        {"id": customer_id, "o": org_id},
    )
    row = res.first()
    if not row or not row.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Mijoz topilmadi yoki faol emas")
    return dict(row._mapping)
