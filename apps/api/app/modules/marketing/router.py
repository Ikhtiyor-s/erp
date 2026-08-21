from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_org_id, get_current_user_id


router = APIRouter(prefix="/marketing", tags=["marketing"])


# =========================================================
# DISCOUNTS
# =========================================================

class DiscountIn(BaseModel):
    name: str
    discount_type: str  # 'percent' | 'fixed'
    value: Decimal
    valid_from: date | None = None
    valid_to: date | None = None
    applies_to: str = "all"  # 'all' | 'product' | 'category' | 'customer_category'
    target_id: str | None = None
    notes: str | None = None


@router.get("/discounts")
async def list_discounts(
    q: str | None = Query(None),
    is_active: bool | None = Query(None),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    where = "WHERE organization_id = :o"
    params: dict = {"o": org_id}
    if q:
        where += " AND name ILIKE :q"
        params["q"] = f"%{q}%"
    if is_active is not None:
        where += " AND is_active = :a"
        params["a"] = is_active
    res = await db.execute(
        text(f"SELECT id, name, discount_type, value, valid_from, valid_to, "
             f"applies_to, target_id, notes, is_active, created_at "
             f"FROM marketing_discounts {where} ORDER BY valid_from DESC NULLS LAST, name"),
        params,
    )
    return [dict(r._mapping) for r in res]


@router.post("/discounts", status_code=status.HTTP_201_CREATED)
async def create_discount(
    p: DiscountIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    did = uuid4()
    await db.execute(
        text("INSERT INTO marketing_discounts "
             "(id, organization_id, name, discount_type, value, valid_from, valid_to, "
             "applies_to, target_id, notes, created_by) "
             "VALUES (:id, :o, :n, :t, :v, :vf, :vt, :a, :tg, :nt, :u)"),
        {"id": str(did), "o": org_id, "n": p.name, "t": p.discount_type,
         "v": p.value, "vf": p.valid_from, "vt": p.valid_to,
         "a": p.applies_to, "tg": p.target_id, "nt": p.notes, "u": user_id},
    )
    await db.commit()
    return {"id": str(did)}


@router.put("/discounts/{did}")
async def update_discount(
    did: UUID, p: DiscountIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("UPDATE marketing_discounts SET name=:n, discount_type=:t, value=:v, "
             "valid_from=:vf, valid_to=:vt, applies_to=:a, target_id=:tg, notes=:nt "
             "WHERE id = :id AND organization_id = :o RETURNING id"),
        {"id": str(did), "o": org_id, "n": p.name, "t": p.discount_type,
         "v": p.value, "vf": p.valid_from, "vt": p.valid_to,
         "a": p.applies_to, "tg": p.target_id, "nt": p.notes},
    )
    if not res.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    await db.commit()
    return {"ok": True}


@router.delete("/discounts/{did}")
async def delete_discount(
    did: UUID, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await db.execute(
        text("UPDATE marketing_discounts SET is_active = FALSE "
             "WHERE id = :id AND organization_id = :o"),
        {"id": str(did), "o": org_id},
    )
    await db.commit()
    return {"ok": True}


# =========================================================
# EXPECTED PRODUCTS (ожидаемые поступления)
# =========================================================

class ExpectedIn(BaseModel):
    product_id: UUID
    supplier_id: UUID | None = None
    expected_qty: Decimal
    expected_date: date
    notes: str | None = None


@router.get("/expected-products")
async def list_expected(
    q: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    where = "WHERE ep.organization_id = :o"
    params: dict = {"o": org_id}
    if q:
        where += " AND (p.name ILIKE :q OR s.name ILIKE :q OR ep.notes ILIKE :q)"
        params["q"] = f"%{q}%"
    if status_filter:
        where += " AND ep.status = :st"
        params["st"] = status_filter
    res = await db.execute(
        text(f"SELECT ep.id, ep.product_id, p.name AS product_name, p.sku, "
             f"ep.supplier_id, s.name AS supplier_name, "
             f"ep.expected_qty, ep.expected_date, ep.status, ep.notes, ep.created_at "
             f"FROM marketing_expected_products ep "
             f"LEFT JOIN products p ON p.id = ep.product_id "
             f"LEFT JOIN suppliers s ON s.id = ep.supplier_id "
             f"{where} ORDER BY ep.expected_date ASC"),
        params,
    )
    return [dict(r._mapping) for r in res]


@router.post("/expected-products", status_code=status.HTTP_201_CREATED)
async def create_expected(
    p: ExpectedIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    eid = uuid4()
    await db.execute(
        text("INSERT INTO marketing_expected_products "
             "(id, organization_id, product_id, supplier_id, expected_qty, expected_date, notes, created_by) "
             "VALUES (:id, :o, :p, :s, :q, :d, :n, :u)"),
        {"id": str(eid), "o": org_id, "p": str(p.product_id),
         "s": str(p.supplier_id) if p.supplier_id else None,
         "q": p.expected_qty, "d": p.expected_date, "n": p.notes, "u": user_id},
    )
    await db.commit()
    return {"id": str(eid)}


@router.put("/expected-products/{eid}/status")
async def update_expected_status(
    eid: UUID, status: str = Query(...),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    if status not in ("pending", "received", "cancelled"):
        raise HTTPException(400, "Invalid status")
    res = await db.execute(
        text("UPDATE marketing_expected_products SET status = :s "
             "WHERE id = :id AND organization_id = :o RETURNING id"),
        {"id": str(eid), "o": org_id, "s": status},
    )
    if not res.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    await db.commit()
    return {"ok": True}


@router.delete("/expected-products/{eid}")
async def delete_expected(
    eid: UUID, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await db.execute(
        text("DELETE FROM marketing_expected_products WHERE id = :id AND organization_id = :o"),
        {"id": str(eid), "o": org_id},
    )
    await db.commit()
    return {"ok": True}
