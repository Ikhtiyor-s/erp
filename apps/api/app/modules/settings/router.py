from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_org_id
from app.core.secret_box import encrypt as _enc, is_encrypted


router = APIRouter(prefix="/settings", tags=["settings"])


# Heuristic: any field whose name ends with one of these is treated as secret.
# On PUT: encrypted at rest. On GET: masked.
_SECRET_KEY_SUFFIXES = (
    "_password", "_secret", "_token", "_api_key", "_apikey",
    "_private_key", "password", "secret_key", "secret",
)


def _is_secret_field(name: str) -> bool:
    lower = name.lower()
    return any(lower.endswith(s) or lower == s.lstrip("_") for s in _SECRET_KEY_SUFFIXES)


def _encrypt_secrets(value: Any) -> Any:
    """Recursively encrypt secret-like fields. Idempotent."""
    if isinstance(value, dict):
        return {
            k: (_enc(v) if _is_secret_field(k) and isinstance(v, str) and v else _encrypt_secrets(v))
            for k, v in value.items()
        }
    if isinstance(value, list):
        return [_encrypt_secrets(x) for x in value]
    return value


def _mask_secrets(value: Any) -> Any:
    """Recursively mask secret-like fields for API responses (defense in depth)."""
    if isinstance(value, dict):
        out = {}
        for k, v in value.items():
            if _is_secret_field(k) and isinstance(v, str) and v:
                # Show only if it's already encrypted (so frontend can detect "set")
                out[k] = "***" if not is_encrypted(v) else "***encrypted***"
            else:
                out[k] = _mask_secrets(v)
        return out
    if isinstance(value, list):
        return [_mask_secrets(x) for x in value]
    return value


# =========================================================
# ORGANIZATION
# =========================================================

class OrgUpdate(BaseModel):
    name: str
    tin: str | None = None
    address: str | None = None
    phone: str | None = None
    logo_url: str | None = None


@router.get("/organization")
async def org_info(
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT id, name, code, tin, address, phone, logo_url FROM organizations WHERE id = :o"),
        {"o": org_id},
    )
    row = res.first()
    return dict(row._mapping) if row else {}


@router.put("/organization")
async def update_org(
    p: OrgUpdate,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await db.execute(
        text("UPDATE organizations SET name=:n, tin=:t, address=:a, phone=:p, logo_url=:l, "
             "updated_at=NOW() WHERE id = :id"),
        {"n": p.name, "t": p.tin, "a": p.address, "p": p.phone, "l": p.logo_url, "id": org_id},
    )
    await db.commit()
    return {"ok": True}


# =========================================================
# UNIVERSAL KEY/VALUE SETTINGS (JSONB)
# =========================================================

class SettingIn(BaseModel):
    value: dict[str, Any]


@router.get("/key/{key}")
async def get_setting(
    key: str,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT value FROM app_settings WHERE organization_id = :o AND key = :k"),
        {"o": org_id, "k": key},
    )
    row = res.first()
    value = dict(row.value) if row else {}
    return {"key": key, "value": _mask_secrets(value)}


@router.put("/key/{key}")
async def set_setting(
    key: str, p: SettingIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    import json
    # Merge with existing so masked "***" placeholders don't overwrite real secrets
    existing_res = await db.execute(
        text("SELECT value FROM app_settings WHERE organization_id = :o AND key = :k"),
        {"o": org_id, "k": key},
    )
    existing_row = existing_res.first()
    existing = dict(existing_row.value) if existing_row and existing_row.value else {}

    merged: dict[str, Any] = dict(p.value)
    # If client sent a mask placeholder for a secret field, keep the stored ciphertext
    for k, v in list(merged.items()):
        if _is_secret_field(k) and isinstance(v, str) and v in ("***", "***encrypted***"):
            if k in existing:
                merged[k] = existing[k]
            else:
                merged.pop(k)

    # Encrypt any plain-text secret fields before storing
    to_store = _encrypt_secrets(merged)

    await db.execute(
        text("INSERT INTO app_settings (organization_id, key, value) "
             "VALUES (:o, :k, CAST(:v AS JSONB)) "
             "ON CONFLICT (organization_id, key) DO UPDATE "
             "SET value = EXCLUDED.value, updated_at = NOW()"),
        {"o": org_id, "k": key, "v": json.dumps(to_store)},
    )
    await db.commit()
    return {"ok": True}


@router.get("/keys")
async def list_settings(
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT key, value, updated_at FROM app_settings "
             "WHERE organization_id = :o ORDER BY key"),
        {"o": org_id},
    )
    out = []
    for r in res:
        d = dict(r._mapping)
        d["value"] = _mask_secrets(d.get("value") or {})
        out.append(d)
    return out


# =========================================================
# DEVICES
# =========================================================

class DeviceIn(BaseModel):
    name: str
    kind: str  # 'printer', 'scanner', 'scale', 'cash_drawer', ...
    connection: str | None = None  # 'usb', 'network', 'bluetooth'
    address: str | None = None
    config: dict[str, Any] = {}


@router.get("/devices")
async def list_devices(
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT id, name, kind, connection, address, is_active, config FROM devices "
             "WHERE organization_id = :o ORDER BY kind, name"),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


@router.post("/devices", status_code=status.HTTP_201_CREATED)
async def create_device(
    p: DeviceIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    import json
    res = await db.execute(
        text("INSERT INTO devices (organization_id, name, kind, connection, address, config) "
             "VALUES (:o, :n, :k, :c, :a, CAST(:cfg AS JSONB)) RETURNING id"),
        {"o": org_id, "n": p.name, "k": p.kind, "c": p.connection,
         "a": p.address, "cfg": json.dumps(p.config)},
    )
    await db.commit()
    return {"id": res.scalar()}


@router.put("/devices/{did}")
async def update_device(
    did: int, p: DeviceIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    import json
    res = await db.execute(
        text("UPDATE devices SET name=:n, kind=:k, connection=:c, address=:a, config=CAST(:cfg AS JSONB) "
             "WHERE id = :id AND organization_id = :o RETURNING id"),
        {"id": did, "o": org_id, "n": p.name, "k": p.kind, "c": p.connection,
         "a": p.address, "cfg": json.dumps(p.config)},
    )
    if not res.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    await db.commit()
    return {"ok": True}


@router.delete("/devices/{did}")
async def delete_device(
    did: int, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await db.execute(
        text("UPDATE devices SET is_active = FALSE "
             "WHERE id = :id AND organization_id = :o"),
        {"id": did, "o": org_id},
    )
    await db.commit()
    return {"ok": True}


# =========================================================
# PRINT TEMPLATES
# =========================================================

class TemplateIn(BaseModel):
    kind: str  # 'receipt', 'label', 'invoice'
    name: str
    body: str
    is_default: bool = False


@router.get("/print-templates")
async def list_templates(
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT id, kind, name, is_default, is_active, updated_at FROM print_templates "
             "WHERE organization_id = :o AND is_active = TRUE ORDER BY kind, name"),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


@router.get("/print-templates/{tid}")
async def get_template(
    tid: int, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT * FROM print_templates WHERE id = :id AND organization_id = :o"),
        {"id": tid, "o": org_id},
    )
    row = res.first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    return dict(row._mapping)


@router.post("/print-templates", status_code=status.HTTP_201_CREATED)
async def create_template(
    p: TemplateIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    if p.is_default:
        await db.execute(
            text("UPDATE print_templates SET is_default = FALSE "
                 "WHERE organization_id = :o AND kind = :k"),
            {"o": org_id, "k": p.kind},
        )
    res = await db.execute(
        text("INSERT INTO print_templates (organization_id, kind, name, body, is_default) "
             "VALUES (:o, :k, :n, :b, :d) RETURNING id"),
        {"o": org_id, "k": p.kind, "n": p.name, "b": p.body, "d": p.is_default},
    )
    await db.commit()
    return {"id": res.scalar()}


@router.put("/print-templates/{tid}")
async def update_template(
    tid: int, p: TemplateIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    if p.is_default:
        await db.execute(
            text("UPDATE print_templates SET is_default = FALSE "
                 "WHERE organization_id = :o AND kind = :k AND id <> :id"),
            {"o": org_id, "k": p.kind, "id": tid},
        )
    res = await db.execute(
        text("UPDATE print_templates SET kind=:k, name=:n, body=:b, is_default=:d, updated_at=NOW() "
             "WHERE id = :id AND organization_id = :o RETURNING id"),
        {"id": tid, "o": org_id, "k": p.kind, "n": p.name, "b": p.body, "d": p.is_default},
    )
    if not res.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    await db.commit()
    return {"ok": True}


@router.delete("/print-templates/{tid}")
async def delete_template(
    tid: int, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await db.execute(
        text("UPDATE print_templates SET is_active = FALSE "
             "WHERE id = :id AND organization_id = :o"),
        {"id": tid, "o": org_id},
    )
    await db.commit()
    return {"ok": True}
