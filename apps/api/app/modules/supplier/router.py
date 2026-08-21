from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_org_id, get_current_user_id


router = APIRouter(prefix="/supplier", tags=["supplier"])


# =========================================================
# SUPPLIERS
# =========================================================

class SupplierIn(BaseModel):
    name: str
    code: str | None = None
    phone: str | None = None
    email: str | None = None
    tin: str | None = None
    address: str | None = None


@router.get("/suppliers")
async def list_suppliers(
    q: str | None = Query(None),
    db: AsyncSession = Depends(get_db), org_id: str = Depends(get_current_org_id),
):
    where = "WHERE s.organization_id = :o AND s.is_active = TRUE"
    params: dict = {"o": org_id}
    if q:
        where += " AND (s.name ILIKE :q OR s.phone ILIKE :q OR s.code ILIKE :q OR s.tin ILIKE :q)"
        params["q"] = f"%{q}%"
    res = await db.execute(
        text(f"SELECT s.id, s.code, "
             f"('A' || COALESCE(s.code, SUBSTRING(s.id::text, 1, 8))) AS uuid_label, "
             f"s.name, s.phone, s.email, s.tin, s.address, s.created_at, "
             f"o.name AS org_name, "
             f"COALESCE((SELECT SUM(CASE WHEN direction='in' THEN amount ELSE -amount END) "
             f"          FROM cash_movements WHERE supplier_id = s.id), 0) AS balance "
             f"FROM suppliers s "
             f"LEFT JOIN organizations o ON o.id = s.organization_id "
             f"{where} ORDER BY s.name"),
        params,
    )
    return [dict(r._mapping) for r in res]


@router.post("/suppliers", status_code=status.HTTP_201_CREATED)
async def create_supplier(
    p: SupplierIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    sid = uuid4()
    await db.execute(
        text("INSERT INTO suppliers (id, organization_id, code, name, phone, email, tin, address) "
             "VALUES (:id, :o, :c, :n, :ph, :e, :t, :a)"),
        {"id": str(sid), "o": org_id, "c": p.code, "n": p.name,
         "ph": p.phone, "e": p.email, "t": p.tin, "a": p.address},
    )
    await db.commit()
    return {"id": str(sid)}


@router.put("/suppliers/{sid}")
async def update_supplier(
    sid: UUID, p: SupplierIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("UPDATE suppliers SET code=:c, name=:n, phone=:ph, email=:e, tin=:t, address=:a "
             "WHERE id = :id AND organization_id = :o RETURNING id"),
        {"id": str(sid), "o": org_id, "c": p.code, "n": p.name,
         "ph": p.phone, "e": p.email, "t": p.tin, "a": p.address},
    )
    if not res.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    await db.commit()
    return {"ok": True}


@router.delete("/suppliers/{sid}")
async def delete_supplier(
    sid: UUID, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await db.execute(
        text("UPDATE suppliers SET is_active = FALSE "
             "WHERE id = :id AND organization_id = :o"),
        {"id": str(sid), "o": org_id},
    )
    await db.commit()
    return {"ok": True}


# =========================================================
# BALANCE (per supplier + list)
# =========================================================

@router.get("/balance")
async def supplier_balances(
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("""
        SELECT s.id AS supplier_id, s.name,
               COALESCE(SUM(CASE WHEN cm.direction='in' THEN cm.amount ELSE -cm.amount END), 0) AS balance
        FROM suppliers s
        LEFT JOIN cash_movements cm ON cm.supplier_id = s.id
        WHERE s.organization_id = :o AND s.is_active = TRUE
        GROUP BY s.id, s.name
        ORDER BY s.name
        """),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


@router.get("/suppliers/{sid}")
async def supplier_profile(
    sid: UUID, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    head = await db.execute(
        text("SELECT s.id, s.code, s.name, s.phone, s.email, s.tin, s.address, "
             "s.created_at, s.is_active, "
             "('A' || COALESCE(s.code, SUBSTRING(s.id::text, 1, 8))) AS uuid_label "
             "FROM suppliers s WHERE s.id = :id AND s.organization_id = :o"),
        {"id": str(sid), "o": org_id},
    )
    h = head.first()
    if not h:
        raise HTTPException(status.HTTP_404_NOT_FOUND)

    balance = await db.execute(
        text("SELECT COALESCE(SUM(CASE WHEN direction='in' THEN amount ELSE -amount END), 0) AS bal, "
             "COUNT(*) AS cnt FROM cash_movements WHERE supplier_id = :id"),
        {"id": str(sid)},
    )

    supplies = await db.execute(
        text("SELECT COUNT(*) AS cnt, COALESCE(SUM(total_amount), 0) AS total, "
             "MAX(supply_date) AS last_supply "
             "FROM supplies WHERE supplier_id = :id AND organization_id = :o"),
        {"id": str(sid), "o": org_id},
    )

    movements = await db.execute(
        text("SELECT cm.id, cm.direction, cm.amount, cm.description, cm.movement_date, "
             "cb.name AS cashbox_name, cur.code AS currency_code, "
             "pt.name AS payment_type_name "
             "FROM cash_movements cm "
             "LEFT JOIN cashboxes cb ON cb.id = cm.cashbox_id "
             "LEFT JOIN currencies cur ON cur.id = cm.currency_id "
             "LEFT JOIN payment_types pt ON pt.id = cm.payment_type_id "
             "WHERE cm.supplier_id = :id "
             "ORDER BY cm.movement_date DESC LIMIT 50"),
        {"id": str(sid)},
    )

    recent_supplies = await db.execute(
        text("SELECT sp.id, sp.doc_number, sp.supply_date, sp.total_amount, "
             "sp.status, w.name AS warehouse_name "
             "FROM supplies sp LEFT JOIN warehouses w ON w.id = sp.warehouse_id "
             "WHERE sp.supplier_id = :id AND sp.organization_id = :o "
             "ORDER BY sp.supply_date DESC LIMIT 30"),
        {"id": str(sid), "o": org_id},
    )

    return {
        "head": dict(h._mapping),
        "balance": dict(balance.first()._mapping),
        "supplies": dict(supplies.first()._mapping),
        "movements": [dict(r._mapping) for r in movements],
        "recent_supplies": [dict(r._mapping) for r in recent_supplies],
    }


@router.get("/suppliers/{sid}/balance")
async def supplier_one_balance(
    sid: UUID, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT id, name, "
             "COALESCE((SELECT SUM(CASE WHEN direction='in' THEN amount ELSE -amount END) "
             "FROM cash_movements WHERE supplier_id = s.id), 0) AS balance "
             "FROM suppliers s WHERE s.id = :id AND s.organization_id = :o"),
        {"id": str(sid), "o": org_id},
    )
    row = res.first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    return dict(row._mapping)


class SetBalanceIn(BaseModel):
    new_balance: Decimal
    notes: str | None = None


@router.post("/suppliers/{sid}/set-balance", status_code=status.HTTP_201_CREATED)
async def set_supplier_balance(
    sid: UUID, p: SetBalanceIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    cur = await db.execute(
        text("SELECT COALESCE((SELECT SUM(CASE WHEN direction='in' THEN amount ELSE -amount END) "
             "FROM cash_movements WHERE supplier_id = :id), 0) AS bal"),
        {"id": str(sid)},
    )
    cur_bal = Decimal(str(cur.scalar() or 0))
    diff = p.new_balance - cur_bal

    await db.execute(
        text("INSERT INTO entity_set_balance "
             "(organization_id, subject_type, subject_id, plan_amount, fact_amount, notes, created_by) "
             "VALUES (:o, 'supplier', :s, :p, :f, :n, :u)"),
        {"o": org_id, "s": str(sid), "p": cur_bal, "f": p.new_balance,
         "n": p.notes, "u": user_id},
    )

    if diff != 0:
        await db.execute(
            text("INSERT INTO cash_movements "
                 "(organization_id, direction, amount, supplier_id, description, created_by) "
                 "VALUES (:o, :dir, :amt, :s, :d, :u)"),
            {"o": org_id, "dir": "in" if diff > 0 else "out",
             "amt": abs(diff), "s": str(sid),
             "d": f"Корректировка баланса: {p.notes or ''}".strip(),
             "u": user_id},
        )

    await db.commit()
    return {"old_balance": float(cur_bal), "new_balance": float(p.new_balance),
            "diff": float(diff)}


# =========================================================
# SUPPLIES (purchase / kirim — ombor qoldig'ini oshiradi)
# =========================================================

class SupplyItemIn(BaseModel):
    product_id: UUID
    quantity: Decimal = Field(gt=0)
    price: Decimal = Field(ge=0)


class SupplyIn(BaseModel):
    supplier_id: UUID
    warehouse_id: int
    supply_date: date
    currency_id: int | None = None
    rate: Decimal = Decimal("1")
    notes: str | None = None
    items: list[SupplyItemIn] = Field(min_length=1)


@router.get("/supplies")
async def list_supplies(
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT s.id, s.doc_number, s.supply_date, s.total_amount, s.status, "
             "sup.name AS supplier_name, w.name AS warehouse_name "
             "FROM supplies s "
             "LEFT JOIN suppliers sup ON sup.id = s.supplier_id "
             "LEFT JOIN warehouses w ON w.id = s.warehouse_id "
             "WHERE s.organization_id = :o "
             "ORDER BY s.supply_date DESC, s.created_at DESC LIMIT :lim OFFSET :off"),
        {"o": org_id, "lim": limit, "off": offset},
    )
    return [dict(r._mapping) for r in res]


@router.post("/supplies", status_code=status.HTTP_201_CREATED)
async def create_supply(
    p: SupplyIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    sid = uuid4()
    total = sum(i.quantity * i.price for i in p.items)

    await db.execute(
        text("INSERT INTO supplies (id, organization_id, supplier_id, warehouse_id, "
             "supply_date, currency_id, rate, total_amount, status, notes, created_by) "
             "VALUES (:id, :o, :sup, :wh, :d, :cur, :r, :t, 'received', :n, :u)"),
        {"id": str(sid), "o": org_id, "sup": str(p.supplier_id), "wh": p.warehouse_id,
         "d": p.supply_date, "cur": p.currency_id, "r": p.rate, "t": total,
         "n": p.notes, "u": user_id},
    )

    for it in p.items:
        await db.execute(
            text("INSERT INTO supply_items (supply_id, product_id, quantity, price) "
                 "VALUES (:s, :p, :q, :pr)"),
            {"s": str(sid), "p": str(it.product_id), "q": it.quantity, "pr": it.price},
        )
        # Stock increase
        await db.execute(
            text("INSERT INTO stock_balances (warehouse_id, product_id, quantity, avg_cost) "
                 "VALUES (:wh, :p, :q, :c) "
                 "ON CONFLICT (warehouse_id, product_id) DO UPDATE "
                 "SET quantity = stock_balances.quantity + :q, "
                 "    avg_cost = ((stock_balances.quantity * stock_balances.avg_cost) + (:q * :c)) "
                 "             / NULLIF(stock_balances.quantity + :q, 0)"),
            {"wh": p.warehouse_id, "p": str(it.product_id), "q": it.quantity, "c": it.price},
        )

    await db.commit()
    return {"id": str(sid), "total_amount": total}


@router.get("/supplies/{sid}")
async def get_supply(
    sid: UUID, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    head = await db.execute(
        text("SELECT * FROM supplies WHERE id = :id AND organization_id = :o"),
        {"id": str(sid), "o": org_id},
    )
    head_row = head.first()
    if not head_row:
        raise HTTPException(status.HTTP_404_NOT_FOUND)

    items = await db.execute(
        text("SELECT si.product_id, p.name AS product_name, si.quantity, si.price, si.amount "
             "FROM supply_items si LEFT JOIN products p ON p.id = si.product_id "
             "WHERE si.supply_id = :id"),
        {"id": str(sid)},
    )
    return {
        "head": dict(head_row._mapping),
        "items": [dict(r._mapping) for r in items],
    }


# =========================================================
# PURCHASE ORDERS (zayavka na zakup)
# =========================================================

class POItemIn(BaseModel):
    product_id: UUID
    quantity: Decimal
    price: Decimal


class POIn(BaseModel):
    supplier_id: UUID
    warehouse_id: int | None = None
    expected_date: date | None = None
    notes: str | None = None
    items: list[POItemIn] = []


@router.get("/purchase-orders")
async def list_purchase_orders(
    q: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    where = "WHERE po.organization_id = :o"
    params: dict = {"o": org_id}
    if q:
        where += " AND (po.doc_number::text ILIKE :q OR s.name ILIKE :q)"
        params["q"] = f"%{q}%"
    if status_filter:
        where += " AND po.status = :st"
        params["st"] = status_filter
    res = await db.execute(
        text(f"SELECT po.id, po.doc_number, po.order_date, po.expected_date, "
             f"po.status, po.total_amount, po.notes, "
             f"po.supplier_id, s.name AS supplier_name, "
             f"po.warehouse_id, w.name AS warehouse_name "
             f"FROM purchase_orders po "
             f"LEFT JOIN suppliers s ON s.id = po.supplier_id "
             f"LEFT JOIN warehouses w ON w.id = po.warehouse_id "
             f"{where} ORDER BY po.order_date DESC, po.created_at DESC LIMIT 200"),
        params,
    )
    return [dict(r._mapping) for r in res]


@router.post("/purchase-orders", status_code=status.HTTP_201_CREATED)
async def create_purchase_order(
    p: POIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    oid = uuid4()
    total = sum(Decimal(str(it.quantity)) * Decimal(str(it.price)) for it in p.items)
    await db.execute(
        text("INSERT INTO purchase_orders (id, organization_id, supplier_id, warehouse_id, "
             "expected_date, total_amount, notes, created_by) "
             "VALUES (:id, :o, :s, :w, :d, :t, :n, :u)"),
        {"id": str(oid), "o": org_id, "s": str(p.supplier_id),
         "w": p.warehouse_id, "d": p.expected_date,
         "t": total, "n": p.notes, "u": user_id},
    )
    for it in p.items:
        await db.execute(
            text("INSERT INTO purchase_order_items (order_id, product_id, quantity, price) "
                 "VALUES (:o, :p, :q, :pr)"),
            {"o": str(oid), "p": str(it.product_id), "q": it.quantity, "pr": it.price},
        )
    await db.commit()
    return {"id": str(oid), "total_amount": float(total)}


@router.put("/purchase-orders/{oid}/status")
async def update_po_status(
    oid: UUID, status_val: str = Query(..., alias="status"),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    if status_val not in ("new", "sent", "received", "cancelled"):
        raise HTTPException(400, "Invalid status")
    res = await db.execute(
        text("UPDATE purchase_orders SET status = :s "
             "WHERE id = :id AND organization_id = :o RETURNING id"),
        {"id": str(oid), "o": org_id, "s": status_val},
    )
    if not res.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    await db.commit()
    return {"ok": True}


@router.delete("/purchase-orders/{oid}")
async def delete_purchase_order(
    oid: UUID, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await db.execute(
        text("DELETE FROM purchase_orders WHERE id = :id AND organization_id = :o"),
        {"id": str(oid), "o": org_id},
    )
    await db.commit()
    return {"ok": True}
