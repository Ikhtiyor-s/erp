from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_user_id, get_current_org_id


router = APIRouter(prefix="/manufacturing", tags=["manufacturing"])


# =========================================================
# BOM (retsept)
# =========================================================

class BomItemIn(BaseModel):
    product_id: UUID
    quantity: Decimal = Field(gt=0)


class BomIn(BaseModel):
    product_id: UUID
    name: str | None = None
    output_qty: Decimal = Decimal("1")
    items: list[BomItemIn] = Field(default_factory=list)


@router.get("/bom")
async def list_bom(
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT b.id, b.product_id, b.name, b.output_qty, p.name AS product_name "
             "FROM bom b LEFT JOIN products p ON p.id = b.product_id "
             "WHERE b.organization_id = :o AND b.is_active = TRUE "
             "ORDER BY p.name"),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


@router.post("/bom", status_code=status.HTTP_201_CREATED)
async def create_bom(
    p: BomIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    bid = uuid4()
    await db.execute(
        text("INSERT INTO bom (id, organization_id, product_id, name, output_qty) "
             "VALUES (:id, :o, :p, :n, :oq)"),
        {"id": str(bid), "o": org_id, "p": str(p.product_id),
         "n": p.name, "oq": p.output_qty},
    )
    for it in p.items:
        await db.execute(
            text("INSERT INTO bom_items (bom_id, product_id, quantity) "
                 "VALUES (:b, :p, :q)"),
            {"b": str(bid), "p": str(it.product_id), "q": it.quantity},
        )
    await db.commit()
    return {"id": str(bid)}


@router.get("/bom/{bid}")
async def get_bom(
    bid: UUID, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    head = await db.execute(
        text("SELECT b.*, p.name AS product_name FROM bom b "
             "LEFT JOIN products p ON p.id = b.product_id "
             "WHERE b.id = :id AND b.organization_id = :o"),
        {"id": str(bid), "o": org_id},
    )
    h = head.first()
    if not h:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    items = await db.execute(
        text("SELECT bi.product_id, p.name AS product_name, bi.quantity "
             "FROM bom_items bi LEFT JOIN products p ON p.id = bi.product_id "
             "WHERE bi.bom_id = :id"),
        {"id": str(bid)},
    )
    return {"head": dict(h._mapping), "items": [dict(r._mapping) for r in items]}


@router.put("/bom/{bid}")
async def update_bom(
    bid: UUID, p: BomIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("UPDATE bom SET product_id=:p, name=:n, output_qty=:oq "
             "WHERE id = :id AND organization_id = :o RETURNING id"),
        {"id": str(bid), "o": org_id, "p": str(p.product_id),
         "n": p.name, "oq": p.output_qty},
    )
    if not res.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    await db.execute(text("DELETE FROM bom_items WHERE bom_id = :id"), {"id": str(bid)})
    for it in p.items:
        await db.execute(
            text("INSERT INTO bom_items (bom_id, product_id, quantity) "
                 "VALUES (:b, :p, :q)"),
            {"b": str(bid), "p": str(it.product_id), "q": it.quantity},
        )
    await db.commit()
    return {"ok": True}


@router.delete("/bom/{bid}")
async def delete_bom(
    bid: UUID, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await db.execute(
        text("UPDATE bom SET is_active = FALSE "
             "WHERE id = :id AND organization_id = :o"),
        {"id": str(bid), "o": org_id},
    )
    await db.commit()
    return {"ok": True}


# =========================================================
# PRODUCTION ORDERS
# =========================================================

class ProductionIn(BaseModel):
    bom_id: UUID
    warehouse_id: int
    warehouse_from_id: int | None = None
    planned_qty: Decimal = Field(gt=0)
    responsible_id: UUID | None = None
    notes: str | None = None


@router.get("/production-orders")
async def list_orders(
    status_filter: str | None = Query(None, alias="status"),
    q: str | None = Query(None),
    responsible_id: UUID | None = Query(None),
    warehouse_id: int | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    limit: int = Query(200, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    where = "WHERE po.organization_id = :o"
    params: dict = {"o": org_id, "lim": limit, "off": offset}
    if status_filter:
        where += " AND po.status = :st"
        params["st"] = status_filter
    if responsible_id is not None:
        where += " AND po.responsible_id = :r"
        params["r"] = str(responsible_id)
    if warehouse_id is not None:
        where += " AND po.warehouse_id = :w"
        params["w"] = warehouse_id
    if date_from:
        where += " AND po.created_at >= :df"
        params["df"] = date_from
    if date_to:
        where += " AND po.created_at < (CAST(:dt AS date) + INTERVAL '1 day')"
        params["dt"] = date_to
    if q:
        where += (
            " AND (po.doc_number::text ILIKE :q OR p.name ILIKE :q "
            "OR e.full_name ILIKE :q OR po.notes ILIKE :q)"
        )
        params["q"] = f"%{q}%"

    res = await db.execute(
        text(
            f"SELECT po.id, po.doc_number, "
            f"('A' || COALESCE(po.doc_number::text, SUBSTRING(po.id::text, 1, 8))) AS uuid_label, "
            f"po.planned_qty, po.produced_qty, po.status, "
            f"po.started_at, po.finished_at, po.created_at, "
            f"p.name AS product_name, p.id AS product_id, "
            f"w.name AS warehouse_name, po.warehouse_id, "
            f"e.full_name AS responsible_name, po.responsible_id, "
            f"u.full_name AS created_by_name, "
            f"org.name AS org_name "
            f"FROM production_orders po "
            f"LEFT JOIN products p ON p.id = po.product_id "
            f"LEFT JOIN warehouses w ON w.id = po.warehouse_id "
            f"LEFT JOIN employees e ON e.id = po.responsible_id "
            f"LEFT JOIN users u ON u.id = po.created_by "
            f"LEFT JOIN organizations org ON org.id = po.organization_id "
            f"{where} ORDER BY po.created_at DESC LIMIT :lim OFFSET :off"
        ),
        params,
    )
    return [dict(r._mapping) for r in res]


@router.post("/production-orders", status_code=status.HTTP_201_CREATED)
async def create_order(
    p: ProductionIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    bom = await db.execute(
        text("SELECT product_id FROM bom WHERE id = :id AND organization_id = :o"),
        {"id": str(p.bom_id), "o": org_id},
    )
    b = bom.first()
    if not b:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "BOM not found")

    oid = uuid4()
    await db.execute(
        text("INSERT INTO production_orders (id, organization_id, bom_id, product_id, "
             "warehouse_id, warehouse_from_id, planned_qty, responsible_id, status, notes, created_by) "
             "VALUES (:id, :o, :b, :p, :w, :wf, :q, :r, 'draft', :n, :u)"),
        {"id": str(oid), "o": org_id, "b": str(p.bom_id),
         "p": str(b.product_id), "w": p.warehouse_id, "wf": p.warehouse_from_id,
         "q": p.planned_qty,
         "r": str(p.responsible_id) if p.responsible_id else None, "n": p.notes,
         "u": user_id},
    )
    await db.commit()
    return {"id": str(oid)}


@router.get("/production-orders/{oid}")
async def get_order(
    oid: UUID, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    head = await db.execute(
        text("SELECT po.*, p.name AS product_name, w.name AS warehouse_name, "
             "e.full_name AS responsible_name, b.name AS bom_name, b.output_qty "
             "FROM production_orders po "
             "LEFT JOIN products p ON p.id = po.product_id "
             "LEFT JOIN warehouses w ON w.id = po.warehouse_id "
             "LEFT JOIN employees e ON e.id = po.responsible_id "
             "LEFT JOIN bom b ON b.id = po.bom_id "
             "WHERE po.id = :id AND po.organization_id = :o"),
        {"id": str(oid), "o": org_id},
    )
    h = head.first()
    if not h:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    items = await db.execute(
        text("SELECT bi.product_id, p.name AS product_name, bi.quantity "
             "FROM bom_items bi LEFT JOIN products p ON p.id = bi.product_id "
             "WHERE bi.bom_id = :b"),
        {"b": str(h.bom_id)},
    )
    return {"head": dict(h._mapping), "ingredients": [dict(r._mapping) for r in items]}


@router.post("/production-orders/{oid}/start")
async def start_order(
    oid: UUID, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await db.execute(
        text("UPDATE production_orders SET status='in_progress', started_at=NOW() "
             "WHERE id = :id AND organization_id = :o AND status = 'draft'"),
        {"id": str(oid), "o": org_id},
    )
    await db.commit()
    return {"ok": True}


class FinishIn(BaseModel):
    produced_qty: Decimal = Field(gt=0)


@router.post("/production-orders/{oid}/finish")
async def finish_order(
    oid: UUID, p: FinishIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    head = await db.execute(
        text("SELECT bom_id, product_id, warehouse_id, warehouse_from_id, status "
             "FROM production_orders WHERE id = :id AND organization_id = :o"),
        {"id": str(oid), "o": org_id},
    )
    row = head.first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    if row.status == "completed":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Уже завершено")

    bom_head = await db.execute(
        text("SELECT output_qty FROM bom WHERE id = :id"), {"id": str(row.bom_id)},
    )
    output_qty = Decimal(str(bom_head.scalar() or 1))
    multiplier = p.produced_qty / output_qty

    items = await db.execute(
        text("SELECT product_id, quantity FROM bom_items WHERE bom_id = :b"),
        {"b": str(row.bom_id)},
    )
    from_wh = row.warehouse_from_id or row.warehouse_id

    total_cost = Decimal("0")
    for it in items:
        consume_qty = Decimal(str(it.quantity)) * multiplier
        cost_res = await db.execute(
            text("SELECT avg_cost FROM stock_balances WHERE warehouse_id=:w AND product_id=:p"),
            {"w": from_wh, "p": str(it.product_id)},
        )
        cost = Decimal(str(cost_res.scalar() or 0))
        total_cost += consume_qty * cost
        # Decrement raw
        await db.execute(
            text("INSERT INTO stock_balances (warehouse_id, product_id, quantity, avg_cost) "
                 "VALUES (:w, :p, :neg, 0) "
                 "ON CONFLICT (warehouse_id, product_id) DO UPDATE "
                 "SET quantity = stock_balances.quantity + :neg, updated_at = NOW()"),
            {"w": from_wh, "p": str(it.product_id), "neg": -consume_qty},
        )

    # Increment finished product
    unit_cost = (total_cost / p.produced_qty) if p.produced_qty > 0 else Decimal("0")
    await db.execute(
        text("INSERT INTO stock_balances (warehouse_id, product_id, quantity, avg_cost) "
             "VALUES (:w, :p, :q, :c) "
             "ON CONFLICT (warehouse_id, product_id) DO UPDATE "
             "SET quantity = stock_balances.quantity + :q, "
             "    avg_cost = ((stock_balances.quantity * stock_balances.avg_cost) + (:q * :c)) "
             "             / NULLIF(stock_balances.quantity + :q, 0), "
             "    updated_at = NOW()"),
        {"w": row.warehouse_id, "p": str(row.product_id),
         "q": p.produced_qty, "c": unit_cost},
    )

    await db.execute(
        text("UPDATE production_orders SET status='completed', produced_qty=:pq, finished_at=NOW() "
             "WHERE id = :id"),
        {"pq": p.produced_qty, "id": str(oid)},
    )
    await db.commit()
    return {"ok": True, "unit_cost": float(unit_cost), "total_cost": float(total_cost)}


@router.delete("/production-orders/{oid}")
async def cancel_order(
    oid: UUID, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await db.execute(
        text("UPDATE production_orders SET status='cancelled' "
             "WHERE id = :id AND organization_id = :o AND status <> 'completed'"),
        {"id": str(oid), "o": org_id},
    )
    await db.commit()
    return {"ok": True}


# =========================================================
# REPORTS
# =========================================================

@router.get("/state-report")
async def state_report(
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT status, COUNT(*) AS cnt, "
             "COALESCE(SUM(planned_qty), 0) AS total_planned, "
             "COALESCE(SUM(produced_qty), 0) AS total_produced "
             "FROM production_orders WHERE organization_id = :o "
             "GROUP BY status ORDER BY status"),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


@router.get("/by-responsible")
async def by_responsible(
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT e.id, e.full_name AS responsible_name, "
             "COUNT(po.id) AS orders_cnt, "
             "COALESCE(SUM(po.planned_qty), 0) AS planned, "
             "COALESCE(SUM(po.produced_qty), 0) AS produced, "
             "COUNT(*) FILTER (WHERE po.status='completed') AS completed_cnt "
             "FROM production_orders po "
             "JOIN employees e ON e.id = po.responsible_id "
             "WHERE po.organization_id = :o "
             "GROUP BY e.id, e.full_name "
             "ORDER BY produced DESC"),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]
