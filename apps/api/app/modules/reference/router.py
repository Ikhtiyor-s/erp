from datetime import date
from decimal import Decimal

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_org_id, get_current_user_id
from app.modules.audit.logger import log_action




async def _is_superadmin(db: AsyncSession, user_id: str) -> bool:
    """CR-4: returns True if user has 'superadmin' role in ANY org (system-wide
    super admin). Reference catalogs are global so the check is org-agnostic."""
    res = await db.execute(
        text(
            "SELECT 1 FROM user_organizations uo "
            "JOIN roles r ON r.id = uo.role_id "
            "WHERE uo.user_id = :u AND r.code = 'superadmin' "
            "  AND uo.is_active = TRUE LIMIT 1"
        ),
        {"u": user_id},
    )
    return res.first() is not None


async def _enforce_global_write_superadmin_only(
    db: AsyncSession,
    user_id: str,
    org_id: str,
    table: str,
    record_id,
    request=None,
) -> None:
    """CR-4: gate PUT/DELETE for currency/unit (global catalog) rows.

    For tables that have NO organization_id column we treat ALL rows as global.
    For tables that DO have organization_id (per-org) the caller MUST own the row
    via the WHERE organization_id = :o filter; this helper is only invoked for
    truly global catalogs (currencies, units).
    """
    if await _is_superadmin(db, user_id):
        return
    await log_action(
        db, org_id, user_id, "forbidden_global_reference_write",
        table, str(record_id),
        diff={"reason": "non-superadmin attempted global reference write",
              "table": table, "record_id": str(record_id)},
        request=request,
    )
    raise HTTPException(
        status.HTTP_403_FORBIDDEN,
        "Faqat Super Admin global ma'lumotnomalarni o'zgartira oladi",
    )


async def _enforce_global_or_own_org(
    db: AsyncSession,
    user_id: str,
    org_id: str,
    table: str,
    record_id,
    request=None,
) -> None:
    """CR-4: for tables WITH organization_id, allow either:
      - record.organization_id == caller's org_id, OR
      - caller is superadmin (can edit truly global rows where org_id IS NULL).
    Raises 403 if caller is non-superadmin AND tries to modify a row that
    is NULL-org or belongs to a different org.
    """
    res = await db.execute(
        text(f"SELECT organization_id FROM {table} WHERE id = :id"),
        {"id": record_id},
    )
    row = res.first()
    if not row:
        return  # let downstream handler raise 404
    record_org = row.organization_id
    if record_org is None:
        # Truly global row — only superadmin may write
        if not await _is_superadmin(db, user_id):
            await log_action(
                db, org_id, user_id, "forbidden_global_reference_write",
                table, str(record_id),
                diff={"reason": "non-superadmin attempted to modify global row",
                      "table": table, "record_id": str(record_id)},
                request=request,
            )
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "Faqat Super Admin global yozuvlarni o'zgartira oladi",
            )
        return
    # Row has an org_id — it must match caller's org (or caller is superadmin)
    if str(record_org) != str(org_id) and not await _is_superadmin(db, user_id):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Bu yozuv boshqa tashkilotga tegishli",
        )


router = APIRouter(prefix="/reference", tags=["reference"])


# =========================================================
# CURRENCIES (global, not per-org)
# =========================================================

class CurrencyIn(BaseModel):
    code: str = Field(min_length=3, max_length=3)
    name: str
    symbol: str | None = None
    is_base: bool = False
    decimals: int = 2


@router.get("/currencies")
async def list_currencies(db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        text("SELECT id, code, name, symbol, is_base, decimals, is_active "
             "FROM currencies ORDER BY is_base DESC, code")
    )
    return [dict(r._mapping) for r in res]


@router.post("/currencies", status_code=status.HTTP_201_CREATED)
async def create_currency(
    p: CurrencyIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
    org_id: str = Depends(get_current_org_id),
):
    await _enforce_global_write_superadmin_only(
        db, user_id, org_id, "currencies", 0, request=request,
    )
    try:
        res = await db.execute(
            text("INSERT INTO currencies (code, name, symbol, is_base, decimals) "
                 "VALUES (:c, :n, :s, :b, :d) RETURNING id"),
            {"c": p.code.upper(), "n": p.name, "s": p.symbol, "b": p.is_base, "d": p.decimals},
        )
        await db.commit()
        return {"id": res.scalar()}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, f"Не удалось создать: {e}")


@router.put("/currencies/{cid}")
async def update_currency(
    cid: int, p: CurrencyIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
    org_id: str = Depends(get_current_org_id),
):
    await _enforce_global_write_superadmin_only(
        db, user_id, org_id, "currencies", cid, request=request,
    )
    res = await db.execute(
        text("UPDATE currencies SET code=:c, name=:n, symbol=:s, is_base=:b, decimals=:d "
             "WHERE id = :id RETURNING id"),
        {"id": cid, "c": p.code.upper(), "n": p.name, "s": p.symbol, "b": p.is_base, "d": p.decimals},
    )
    if not res.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    await db.commit()
    return {"ok": True}


@router.delete("/currencies/{cid}")
async def delete_currency(
    cid: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
    org_id: str = Depends(get_current_org_id),
):
    await _enforce_global_write_superadmin_only(
        db, user_id, org_id, "currencies", cid, request=request,
    )
    await db.execute(text("UPDATE currencies SET is_active = FALSE WHERE id = :id"), {"id": cid})
    await db.commit()
    return {"ok": True}


# =========================================================
# CURRENCY RATES (global, per-date)
# =========================================================

class CurrencyRateIn(BaseModel):
    rate: float = Field(gt=0)
    rate_date: date


@router.get("/currencies/{cid}/rates")
async def list_currency_rates(
    cid: int, limit: int = 30, db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        text("SELECT id, rate, rate_date FROM currency_rates "
             "WHERE currency_id = :c ORDER BY rate_date DESC LIMIT :lim"),
        {"c": cid, "lim": limit},
    )
    return [dict(r._mapping) for r in res]


@router.post("/currencies/{cid}/rates", status_code=status.HTTP_201_CREATED)
async def upsert_currency_rate(
    cid: int, p: CurrencyRateIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
    org_id: str = Depends(get_current_org_id),
):
    await _enforce_global_write_superadmin_only(
        db, user_id, org_id, "currency_rates", cid, request=request,
    )
    try:
        res = await db.execute(
            text("INSERT INTO currency_rates (currency_id, rate, rate_date) "
                 "VALUES (:c, :r, :d) "
                 "ON CONFLICT (currency_id, rate_date) DO UPDATE SET rate = EXCLUDED.rate "
                 "RETURNING id"),
            {"c": cid, "r": p.rate, "d": p.rate_date},
        )
        await db.commit()
        return {"id": res.scalar()}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))


@router.delete("/currencies/{cid}/rates/{rid}")
async def delete_currency_rate(
    cid: int, rid: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
    org_id: str = Depends(get_current_org_id),
):
    await _enforce_global_write_superadmin_only(
        db, user_id, org_id, "currency_rates", rid, request=request,
    )
    await db.execute(
        text("DELETE FROM currency_rates WHERE id = :id AND currency_id = :c"),
        {"id": rid, "c": cid},
    )
    await db.commit()
    return {"ok": True}


@router.post("/currencies/rates/import-cbu", status_code=200)
async def import_cbu_rates(
    request: Request,
    on_date: str | None = None,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
    org_id: str = Depends(get_current_org_id),
):
    """
    Markaziy Bank (cbu.uz) JSON kursini import qiladi.
    UZS bazaviy bo'lsa, boshqa valyutalar uchun: 1 X = N UZS.
    """
    await _enforce_global_write_superadmin_only(
        db, user_id, org_id, "currency_rates", 0, request=request
    )
    d_obj = date.fromisoformat(on_date) if on_date else date.today()
    d = d_obj.isoformat()
    url = f"https://cbu.uz/uz/arkhiv-kursov-valyut/json/all/{d}/"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(url)
            r.raise_for_status()
            data = r.json()
    except Exception as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"CBU не отвечает: {e}")

    cur_res = await db.execute(text("SELECT id, code FROM currencies WHERE is_active = TRUE"))
    code_to_id = {row.code.upper(): row.id for row in cur_res}

    imported = 0
    for item in data:
        code = (item.get("Ccy") or "").upper()
        if code not in code_to_id:
            continue
        try:
            rate = float(item.get("Rate") or 0)
        except (TypeError, ValueError):
            continue
        if rate <= 0:
            continue
        await db.execute(
            text("INSERT INTO currency_rates (currency_id, rate, rate_date) "
                 "VALUES (:c, :r, :d) "
                 "ON CONFLICT (currency_id, rate_date) DO UPDATE SET rate = EXCLUDED.rate"),
            {"c": code_to_id[code], "r": rate, "d": d_obj},
        )
        imported += 1
    await db.commit()
    return {"imported": imported, "date": d}


@router.get("/currencies/rates/latest")
async def latest_rates(db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        text("""
        SELECT DISTINCT ON (c.id) c.id, c.code, c.name, c.symbol,
               cr.rate, cr.rate_date
        FROM currencies c
        LEFT JOIN currency_rates cr ON cr.currency_id = c.id
        WHERE c.is_active = TRUE
        ORDER BY c.id, cr.rate_date DESC NULLS LAST
        """)
    )
    return [dict(r._mapping) for r in res]


# =========================================================
# UNITS (global)
# =========================================================

class UnitIn(BaseModel):
    code: str = Field(min_length=1, max_length=20)
    name: str
    short_name: str | None = None


@router.get("/units")
async def list_units(db: AsyncSession = Depends(get_db)):
    res = await db.execute(text("SELECT id, code, name, short_name FROM units ORDER BY name"))
    return [dict(r._mapping) for r in res]


@router.post("/units", status_code=status.HTTP_201_CREATED)
async def create_unit(
    p: UnitIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
    org_id: str = Depends(get_current_org_id),
):
    await _enforce_global_write_superadmin_only(
        db, user_id, org_id, "units", 0, request=request,
    )
    try:
        res = await db.execute(
            text("INSERT INTO units (code, name, short_name) VALUES (:c, :n, :s) RETURNING id"),
            {"c": p.code, "n": p.name, "s": p.short_name},
        )
        await db.commit()
        return {"id": res.scalar()}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, str(e))


@router.put("/units/{uid}")
async def update_unit(
    uid: int, p: UnitIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
    org_id: str = Depends(get_current_org_id),
):
    await _enforce_global_write_superadmin_only(
        db, user_id, org_id, "units", uid, request=request,
    )
    res = await db.execute(
        text("UPDATE units SET code=:c, name=:n, short_name=:s WHERE id = :id RETURNING id"),
        {"id": uid, "c": p.code, "n": p.name, "s": p.short_name},
    )
    if not res.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    await db.commit()
    return {"ok": True}


@router.delete("/units/{uid}")
async def delete_unit(
    uid: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
    org_id: str = Depends(get_current_org_id),
):
    await _enforce_global_write_superadmin_only(
        db, user_id, org_id, "units", uid, request=request,
    )
    await db.execute(text("DELETE FROM units WHERE id = :id"), {"id": uid})
    await db.commit()
    return {"ok": True}


# =========================================================
# PAYMENT TYPES (per-org)
# =========================================================

class PaymentTypeIn(BaseModel):
    code: str
    name: str
    is_cash: bool = True


@router.get("/payment-types")
async def list_payment_types(
    db: AsyncSession = Depends(get_db), org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT id, code, name, is_cash, is_active FROM payment_types "
             "WHERE organization_id = :o ORDER BY name"),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


@router.post("/payment-types", status_code=status.HTTP_201_CREATED)
async def create_payment_type(
    p: PaymentTypeIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("INSERT INTO payment_types (organization_id, code, name, is_cash) "
             "VALUES (:o, :c, :n, :ic) RETURNING id"),
        {"o": org_id, "c": p.code, "n": p.name, "ic": p.is_cash},
    )
    await db.commit()
    return {"id": res.scalar()}


@router.put("/payment-types/{pid}")
async def update_payment_type(
    pid: int, p: PaymentTypeIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("UPDATE payment_types SET code=:c, name=:n, is_cash=:ic "
             "WHERE id = :id AND organization_id = :o RETURNING id"),
        {"id": pid, "o": org_id, "c": p.code, "n": p.name, "ic": p.is_cash},
    )
    if not res.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    await db.commit()
    return {"ok": True}


@router.delete("/payment-types/{pid}")
async def delete_payment_type(
    pid: int, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await db.execute(
        text("UPDATE payment_types SET is_active = FALSE "
             "WHERE id = :id AND organization_id = :o"),
        {"id": pid, "o": org_id},
    )
    await db.commit()
    return {"ok": True}


# =========================================================
# LOCATIONS (per-org)
# =========================================================

class LocationIn(BaseModel):
    name: str
    address: str | None = None
    phone: str | None = None


@router.get("/locations")
async def list_locations(
    db: AsyncSession = Depends(get_db), org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT id, name, address, phone FROM locations "
             "WHERE organization_id = :o AND is_active = TRUE"),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


@router.post("/locations", status_code=status.HTTP_201_CREATED)
async def create_location(
    p: LocationIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("INSERT INTO locations (organization_id, name, address, phone) "
             "VALUES (:o, :n, :a, :p) RETURNING id"),
        {"o": org_id, "n": p.name, "a": p.address, "p": p.phone},
    )
    await db.commit()
    return {"id": res.scalar()}


@router.put("/locations/{lid}")
async def update_location(
    lid: int, p: LocationIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("UPDATE locations SET name=:n, address=:a, phone=:p "
             "WHERE id = :id AND organization_id = :o RETURNING id"),
        {"id": lid, "o": org_id, "n": p.name, "a": p.address, "p": p.phone},
    )
    if not res.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    await db.commit()
    return {"ok": True}


@router.delete("/locations/{lid}")
async def delete_location(
    lid: int, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await db.execute(
        text("UPDATE locations SET is_active = FALSE "
             "WHERE id = :id AND organization_id = :o"),
        {"id": lid, "o": org_id},
    )
    await db.commit()
    return {"ok": True}


# =========================================================
# LEGAL ENTITIES (per-org)
# =========================================================

class LegalEntityIn(BaseModel):
    name: str
    tin: str | None = None
    oked: str | None = None
    bank_account: str | None = None
    bank_name: str | None = None
    mfo: str | None = None
    address: str | None = None
    phone: str | None = None
    director: str | None = None
    accountant: str | None = None


@router.get("/legal-entities")
async def list_legal_entities(
    db: AsyncSession = Depends(get_db), org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT id, name, tin, oked, bank_account, bank_name, mfo, "
             "address, phone, director, accountant, is_active "
             "FROM legal_entities WHERE organization_id = :o AND is_active = TRUE "
             "ORDER BY name"),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


@router.post("/legal-entities", status_code=status.HTTP_201_CREATED)
async def create_legal_entity(
    p: LegalEntityIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("INSERT INTO legal_entities (organization_id, name, tin, oked, "
             "bank_account, bank_name, mfo, address, phone, director, accountant) "
             "VALUES (:o, :n, :t, :ok, :ba, :bn, :m, :a, :p, :d, :ac) RETURNING id"),
        {"o": org_id, "n": p.name, "t": p.tin, "ok": p.oked,
         "ba": p.bank_account, "bn": p.bank_name, "m": p.mfo,
         "a": p.address, "p": p.phone, "d": p.director, "ac": p.accountant},
    )
    await db.commit()
    return {"id": res.scalar()}


@router.put("/legal-entities/{lid}")
async def update_legal_entity(
    lid: int, p: LegalEntityIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("UPDATE legal_entities SET name=:n, tin=:t, oked=:ok, bank_account=:ba, "
             "bank_name=:bn, mfo=:m, address=:a, phone=:p, director=:d, accountant=:ac "
             "WHERE id = :id AND organization_id = :o RETURNING id"),
        {"id": lid, "o": org_id, "n": p.name, "t": p.tin, "ok": p.oked,
         "ba": p.bank_account, "bn": p.bank_name, "m": p.mfo,
         "a": p.address, "p": p.phone, "d": p.director, "ac": p.accountant},
    )
    if not res.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    await db.commit()
    return {"ok": True}


@router.delete("/legal-entities/{lid}")
async def delete_legal_entity(
    lid: int, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await db.execute(
        text("UPDATE legal_entities SET is_active = FALSE "
             "WHERE id = :id AND organization_id = :o"),
        {"id": lid, "o": org_id},
    )
    await db.commit()
    return {"ok": True}


# =========================================================
# NATURAL PERSONS (per-org)
# =========================================================

class NaturalPersonIn(BaseModel):
    full_name: str
    passport: str | None = None
    pinfl: str | None = None
    phone: str | None = None
    address: str | None = None
    notes: str | None = None


@router.get("/natural-persons")
async def list_natural_persons(
    db: AsyncSession = Depends(get_db), org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT id, full_name, passport, pinfl, phone, address, notes, is_active "
             "FROM natural_persons WHERE organization_id = :o AND is_active = TRUE "
             "ORDER BY full_name"),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


@router.post("/natural-persons", status_code=status.HTTP_201_CREATED)
async def create_natural_person(
    p: NaturalPersonIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("INSERT INTO natural_persons (organization_id, full_name, passport, pinfl, "
             "phone, address, notes) "
             "VALUES (:o, :n, :ps, :pi, :ph, :a, :nt) RETURNING id"),
        {"o": org_id, "n": p.full_name, "ps": p.passport, "pi": p.pinfl,
         "ph": p.phone, "a": p.address, "nt": p.notes},
    )
    await db.commit()
    return {"id": res.scalar()}


@router.put("/natural-persons/{pid}")
async def update_natural_person(
    pid: int, p: NaturalPersonIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("UPDATE natural_persons SET full_name=:n, passport=:ps, pinfl=:pi, "
             "phone=:ph, address=:a, notes=:nt "
             "WHERE id = :id AND organization_id = :o RETURNING id"),
        {"id": pid, "o": org_id, "n": p.full_name, "ps": p.passport, "pi": p.pinfl,
         "ph": p.phone, "a": p.address, "nt": p.notes},
    )
    if not res.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    await db.commit()
    return {"ok": True}


@router.delete("/natural-persons/{pid}")
async def delete_natural_person(
    pid: int, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await db.execute(
        text("UPDATE natural_persons SET is_active = FALSE "
             "WHERE id = :id AND organization_id = :o"),
        {"id": pid, "o": org_id},
    )
    await db.commit()
    return {"ok": True}


# =========================================================
# PRICE LISTS (per-org)
# =========================================================

class PriceListIn(BaseModel):
    name: str
    currency_id: int | None = None
    is_default: bool = False


@router.get("/price-lists")
async def list_price_lists(
    db: AsyncSession = Depends(get_db), org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT pl.id, pl.name, pl.currency_id, pl.is_default, pl.is_active, "
             "cur.code AS currency_code, "
             "(SELECT COUNT(*) FROM price_list_items pi WHERE pi.price_list_id = pl.id) AS item_count "
             "FROM price_lists pl LEFT JOIN currencies cur ON cur.id = pl.currency_id "
             "WHERE pl.organization_id = :o AND pl.is_active = TRUE ORDER BY pl.name"),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


@router.post("/price-lists", status_code=status.HTTP_201_CREATED)
async def create_price_list(
    p: PriceListIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    if p.is_default:
        await db.execute(
            text("UPDATE price_lists SET is_default = FALSE WHERE organization_id = :o"),
            {"o": org_id},
        )
    res = await db.execute(
        text("INSERT INTO price_lists (organization_id, name, currency_id, is_default) "
             "VALUES (:o, :n, :c, :d) RETURNING id"),
        {"o": org_id, "n": p.name, "c": p.currency_id, "d": p.is_default},
    )
    await db.commit()
    return {"id": res.scalar()}


@router.put("/price-lists/{plid}")
async def update_price_list(
    plid: int, p: PriceListIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    if p.is_default:
        await db.execute(
            text("UPDATE price_lists SET is_default = FALSE "
                 "WHERE organization_id = :o AND id <> :id"),
            {"o": org_id, "id": plid},
        )
    res = await db.execute(
        text("UPDATE price_lists SET name=:n, currency_id=:c, is_default=:d "
             "WHERE id = :id AND organization_id = :o RETURNING id"),
        {"id": plid, "o": org_id, "n": p.name, "c": p.currency_id, "d": p.is_default},
    )
    if not res.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    await db.commit()
    return {"ok": True}


@router.delete("/price-lists/{plid}")
async def delete_price_list(
    plid: int, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await db.execute(
        text("UPDATE price_lists SET is_active = FALSE "
             "WHERE id = :id AND organization_id = :o"),
        {"id": plid, "o": org_id},
    )
    await db.commit()
    return {"ok": True}


@router.get("/price-lists/{plid}/items")
async def list_price_items(
    plid: int, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT pi.id, pi.product_id, p.name AS product_name, p.sku, pi.price "
             "FROM price_list_items pi "
             "JOIN products p ON p.id = pi.product_id "
             "WHERE pi.price_list_id = :pl ORDER BY p.name"),
        {"pl": plid},
    )
    return [dict(r._mapping) for r in res]


class PriceItemIn(BaseModel):
    product_id: str
    price: Decimal


@router.post("/price-lists/{plid}/items", status_code=status.HTTP_201_CREATED)
async def upsert_price_item(
    plid: int, p: PriceItemIn,
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        text("INSERT INTO price_list_items (price_list_id, product_id, price) "
             "VALUES (:pl, :p, :pr) "
             "ON CONFLICT (price_list_id, product_id) DO UPDATE SET price = EXCLUDED.price "
             "RETURNING id"),
        {"pl": plid, "p": p.product_id, "pr": p.price},
    )
    await db.commit()
    return {"id": res.scalar()}


@router.delete("/price-lists/{plid}/items/{iid}")
async def delete_price_item(
    plid: int, iid: int, db: AsyncSession = Depends(get_db),
):
    await db.execute(
        text("DELETE FROM price_list_items WHERE id = :id AND price_list_id = :pl"),
        {"id": iid, "pl": plid},
    )
    await db.commit()
    return {"ok": True}


# =========================================================
# WAREHOUSE TYPES (per-org)
# =========================================================

class WarehouseTypeIn(BaseModel):
    name: str
    description: str | None = None


@router.get("/warehouse-types")
async def list_warehouse_types(
    db: AsyncSession = Depends(get_db), org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT id, name, description FROM warehouse_types "
             "WHERE organization_id = :o AND is_active = TRUE ORDER BY name"),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


@router.post("/warehouse-types", status_code=status.HTTP_201_CREATED)
async def create_warehouse_type(
    p: WarehouseTypeIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("INSERT INTO warehouse_types (organization_id, name, description) "
             "VALUES (:o, :n, :d) RETURNING id"),
        {"o": org_id, "n": p.name, "d": p.description},
    )
    await db.commit()
    return {"id": res.scalar()}


@router.put("/warehouse-types/{tid}")
async def update_warehouse_type(
    tid: int, p: WarehouseTypeIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("UPDATE warehouse_types SET name=:n, description=:d "
             "WHERE id = :id AND organization_id = :o RETURNING id"),
        {"id": tid, "o": org_id, "n": p.name, "d": p.description},
    )
    if not res.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    await db.commit()
    return {"ok": True}


@router.delete("/warehouse-types/{tid}")
async def delete_warehouse_type(
    tid: int, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await db.execute(
        text("UPDATE warehouse_types SET is_active = FALSE "
             "WHERE id = :id AND organization_id = :o"),
        {"id": tid, "o": org_id},
    )
    await db.commit()
    return {"ok": True}
