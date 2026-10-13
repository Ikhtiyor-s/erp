"""Admin provisioning CRUD for kiosk device credentials.

tickets/DESIGN-self-checkout-auth.md — "API kontrakti (FREEZE)". Staff JWT +
RBAC (kiosk.view/create/update/delete); gated by rbac/middleware.py's
PermissionMiddleware via URL_MODULE["kiosk-devices"] = "kiosk". The
`require_permission` dependencies below are defense-in-depth / self-documenting
(middleware already enforces the same codes), and are the only way to get
`kiosk.update` on the rotate sub-path without a generic method->action default.
"""
from __future__ import annotations

import secrets
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_org_id, get_current_user_id, get_db
from app.modules.kiosk.auth import hash_kiosk_token
from app.modules.rbac.deps import require_permission


router = APIRouter(prefix="/kiosk-devices", tags=["kiosk-devices"])


class KioskDeviceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    cashbox_id: int


class KioskDeviceUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    cashbox_id: int


def _new_token() -> tuple[str, str, str]:
    """Return (plaintext "kiosk_<token>", token_hash, token_prefix).

    token_hash is SHA-256 of the plaintext *without* the "kiosk_" prefix —
    the prefix is stripped on the auth side too (kiosk/auth.py), so hashing
    must be consistent on both sides.
    """
    plain = secrets.token_urlsafe(32)
    full_token = f"kiosk_{plain}"
    return full_token, hash_kiosk_token(plain), full_token[:9]


async def _check_cashbox_in_org(db: AsyncSession, org_id: str, cashbox_id: int) -> None:
    res = await db.execute(
        text("SELECT 1 FROM cashboxes WHERE id = :c AND organization_id = :o"),
        {"c": cashbox_id, "o": org_id},
    )
    if not res.first():
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "cashbox_id does not belong to your organization",
        )


async def _require_own_device(db: AsyncSession, org_id: str, device_id: UUID) -> None:
    """404 (never 403) for a device that doesn't exist or belongs to another
    org — cross-tenant requests must not be able to confirm the device exists."""
    res = await db.execute(
        text("SELECT 1 FROM kiosk_devices WHERE id = :id AND organization_id = :o"),
        {"id": str(device_id), "o": org_id},
    )
    if not res.first():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Qurilma topilmadi")


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("kiosk.create"))],
)
async def create_kiosk_device(
    payload: KioskDeviceCreate,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    await _check_cashbox_in_org(db, org_id, payload.cashbox_id)

    token, token_hash, token_prefix = _new_token()
    res = await db.execute(
        text(
            "INSERT INTO kiosk_devices "
            "(organization_id, cashbox_id, name, token_hash, token_prefix, created_by) "
            "VALUES (:o, :c, :n, :h, :p, :u) RETURNING id"
        ),
        {
            "o": org_id, "c": payload.cashbox_id, "n": payload.name,
            "h": token_hash, "p": token_prefix, "u": user_id,
        },
    )
    device_id = res.first().id
    await db.commit()

    # `token` is returned here, and only here (plus /rotate) — never stored
    # in plaintext, never returned again by any other endpoint.
    return {
        "id": str(device_id),
        "name": payload.name,
        "cashbox_id": payload.cashbox_id,
        "status": "active",
        "token": token,
        "token_prefix": token_prefix,
    }


@router.get("", dependencies=[Depends(require_permission("kiosk.view"))])
async def list_kiosk_devices(
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text(
            "SELECT kd.id, kd.name, kd.token_prefix, kd.status, kd.cashbox_id, "
            "cb.name AS cashbox_name, w.name AS warehouse_name, "
            "kd.last_used_at, kd.created_at "
            "FROM kiosk_devices kd "
            "LEFT JOIN cashboxes cb ON cb.id = kd.cashbox_id "
            "LEFT JOIN warehouses w ON w.id = cb.warehouse_id "
            "WHERE kd.organization_id = :o "
            "ORDER BY kd.created_at DESC"
        ),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


@router.post(
    "/{device_id}/rotate",
    dependencies=[Depends(require_permission("kiosk.update"))],
)
async def rotate_kiosk_device(
    device_id: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await _require_own_device(db, org_id, device_id)

    token, token_hash, token_prefix = _new_token()
    await db.execute(
        text(
            "UPDATE kiosk_devices SET token_hash = :h, token_prefix = :p "
            "WHERE id = :id AND organization_id = :o"
        ),
        {"h": token_hash, "p": token_prefix, "id": str(device_id), "o": org_id},
    )
    await db.commit()
    # Old token_hash is gone the instant this COMMIT lands — no grace period,
    # no cache to invalidate (get_current_kiosk_device always does a live lookup).
    return {"token": token, "token_prefix": token_prefix}


@router.put(
    "/{device_id}",
    dependencies=[Depends(require_permission("kiosk.update"))],
)
async def update_kiosk_device(
    device_id: UUID,
    payload: KioskDeviceUpdate,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await _require_own_device(db, org_id, device_id)
    await _check_cashbox_in_org(db, org_id, payload.cashbox_id)

    await db.execute(
        text(
            "UPDATE kiosk_devices SET name = :n, cashbox_id = :c "
            "WHERE id = :id AND organization_id = :o"
        ),
        {"n": payload.name, "c": payload.cashbox_id, "id": str(device_id), "o": org_id},
    )
    await db.commit()
    return {"ok": True}


@router.delete(
    "/{device_id}",
    dependencies=[Depends(require_permission("kiosk.delete"))],
)
async def revoke_kiosk_device(
    device_id: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    await _require_own_device(db, org_id, device_id)

    await db.execute(
        text(
            "UPDATE kiosk_devices SET status = 'revoked', revoked_at = NOW(), revoked_by = :u "
            "WHERE id = :id AND organization_id = :o"
        ),
        {"u": user_id, "id": str(device_id), "o": org_id},
    )
    await db.commit()
    return {"ok": True}
