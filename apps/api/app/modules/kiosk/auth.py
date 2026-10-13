"""Kiosk device-credential authentication.

The fourth auth model in this app (tickets/DESIGN-self-checkout-auth.md): a
single physical kiosk authenticates with `Authorization: Bearer kiosk_<token>`
instead of a staff JWT. `kiosk_` is a cosmetic prefix only (not a security
boundary) — the real entropy is the `secrets.token_urlsafe(32)` suffix, which
is SHA-256 hashed and looked up against `kiosk_devices.token_hash` (same
pattern as rbac/router.py::_hash_invitation_token — no bcrypt, see DESIGN doc
for rationale). Revoke/rotate is a flat DB check with no caching, so it takes
effect on the very next request.
"""
from __future__ import annotations

import hashlib

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db

_INVALID_TOKEN = "Qurilma tokeni noto'g'ri yoki bekor qilingan"


def hash_kiosk_token(plain: str) -> str:
    return hashlib.sha256(plain.encode("utf-8")).hexdigest()


async def get_current_kiosk_device(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """FastAPI dependency for every `/api/v1/kiosk/*` endpoint.

    Missing header, unknown token, and revoked token all raise the exact same
    401 — the caller must not be able to distinguish the reason (matches the
    storefront's 404-for-everything caution elsewhere in this app).
    """
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, _INVALID_TOKEN)

    token = auth.split(" ", 1)[1].strip().removeprefix("kiosk_")
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, _INVALID_TOKEN)

    token_hash = hash_kiosk_token(token)
    res = await db.execute(
        text(
            "SELECT id, organization_id, cashbox_id, name, status "
            "FROM kiosk_devices WHERE token_hash = :h"
        ),
        {"h": token_hash},
    )
    row = res.first()
    if not row or row.status != "active":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, _INVALID_TOKEN)

    client_ip = request.client.host if request.client else None
    await db.execute(
        text(
            "UPDATE kiosk_devices SET last_used_at = NOW(), last_used_ip = :ip "
            "WHERE id = :id"
        ),
        {"ip": client_ip, "id": row.id},
    )
    await db.commit()

    return dict(row._mapping)
