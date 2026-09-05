import json
import logging
from datetime import date
from decimal import Decimal
from typing import Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi.responses import Response

from app.core.deps import get_db, get_current_user_id, get_current_org_id
from app.core import secret_box
from app.modules.finance.schemas import (
    CashboxCreate, CashboxOut,
    CashMovementCreate, CashMovementOut,
    CashboxSetBalance, EntitySetBalance, ExtraCostCreate,
)
from app.modules.finance.export_1c import build_export, ExportType
from app.modules.integration.payments.click import create_bill_payment_link, BILL_SERVICES
from app.modules.integration.payments.base import get_payment_settings
from app.modules.integration.sms import eskiz as eskiz_sms
from app.modules.rbac.deps import require_permission


router = APIRouter(prefix="/finance", tags=["finance"])
log = logging.getLogger(__name__)


# =========================================================
# CASHBOXES
# =========================================================

@router.get("/cashboxes")
async def list_cashboxes(
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text(
            "SELECT cb.id, cb.name, cb.currency_id, cb.balance, cb.is_active, "
            "cb.responsible_id, cb.warehouse_id, "
            "cur.code AS currency_code, "
            "e.full_name AS responsible_name, "
            "w.name AS warehouse_name "
            "FROM cashboxes cb "
            "LEFT JOIN currencies cur ON cur.id = cb.currency_id "
            "LEFT JOIN employees e ON e.id = cb.responsible_id "
            "LEFT JOIN warehouses w ON w.id = cb.warehouse_id "
            "WHERE cb.organization_id = :o ORDER BY cb.id"
        ),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


@router.post("/cashboxes", response_model=CashboxOut, status_code=status.HTTP_201_CREATED)
async def create_cashbox(
    payload: CashboxCreate,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    _: str = Depends(get_current_user_id),
):
    if payload.warehouse_id is not None:
        wh_check = await db.execute(
            text("SELECT 1 FROM warehouses WHERE id = :w AND organization_id = :o"),
            {"w": payload.warehouse_id, "o": org_id},
        )
        if not wh_check.first():
            raise HTTPException(422, "warehouse_id does not belong to your organization")
    res = await db.execute(
        text("INSERT INTO cashboxes (organization_id, name, currency_id, responsible_id, warehouse_id) "
             "VALUES (:o, :n, :c, :r, :w) RETURNING id, balance, is_active"),
        {"o": org_id, "n": payload.name, "c": payload.currency_id,
         "r": str(payload.responsible_id) if payload.responsible_id else None,
         "w": payload.warehouse_id},
    )
    row = res.first()
    await db.commit()
    return CashboxOut(id=row.id, name=payload.name, currency_id=payload.currency_id,
                      balance=row.balance, is_active=row.is_active,
                      warehouse_id=payload.warehouse_id)


@router.put("/cashboxes/{cid}")
async def update_cashbox(
    cid: int, payload: CashboxCreate,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    if payload.warehouse_id is not None:
        wh_check = await db.execute(
            text("SELECT 1 FROM warehouses WHERE id = :w AND organization_id = :o"),
            {"w": payload.warehouse_id, "o": org_id},
        )
        if not wh_check.first():
            raise HTTPException(422, "warehouse_id does not belong to your organization")
    res = await db.execute(
        text("UPDATE cashboxes SET name=:n, currency_id=:c, responsible_id=:r, warehouse_id=:w "
             "WHERE id = :id AND organization_id = :o RETURNING id"),
        {"id": cid, "o": org_id, "n": payload.name, "c": payload.currency_id,
         "r": str(payload.responsible_id) if payload.responsible_id else None,
         "w": payload.warehouse_id},
    )
    if not res.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    await db.commit()
    return {"ok": True}


@router.delete("/cashboxes/{cid}")
async def delete_cashbox(
    cid: int, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await db.execute(
        text("UPDATE cashboxes SET is_active = FALSE "
             "WHERE id = :id AND organization_id = :o"),
        {"id": cid, "o": org_id},
    )
    await db.commit()
    return {"ok": True}


# =========================================================
# CASH MOVEMENTS
# =========================================================

@router.get("/movements")
async def list_movements(
    cashbox_id: int | None = Query(None),
    direction: str | None = Query(None),
    payment_type_id: int | None = Query(None),
    customer_id: UUID | None = Query(None),
    supplier_id: UUID | None = Query(None),
    employee_id: UUID | None = Query(None),
    q: str | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    where = "WHERE cm.organization_id = :o"
    params: dict = {"o": org_id, "lim": limit, "off": offset}
    if cashbox_id is not None:
        where += " AND cm.cashbox_id = :cb"
        params["cb"] = cashbox_id
    if direction:
        where += " AND cm.direction = :dir"
        params["dir"] = direction
    if payment_type_id is not None:
        where += " AND cm.payment_type_id = :pt"
        params["pt"] = payment_type_id
    if customer_id is not None:
        where += " AND cm.customer_id = :cu"
        params["cu"] = str(customer_id)
    if supplier_id is not None:
        where += " AND cm.supplier_id = :su"
        params["su"] = str(supplier_id)
    if employee_id is not None:
        where += " AND cm.employee_id = :em"
        params["em"] = str(employee_id)
    # H4: no `::date` cast on movement_date — preserves composite index range scan
    if date_from:
        where += " AND cm.movement_date >= :df"
        params["df"] = date_from
    if date_to:
        where += " AND cm.movement_date < (CAST(:dt AS date) + INTERVAL '1 day')"
        params["dt"] = date_to
    if q:
        where += (
            " AND (cm.description ILIKE :q OR cu.name ILIKE :q OR su.name ILIKE :q "
            "OR em.full_name ILIKE :q)"
        )
        params["q"] = f"%{q}%"

    res = await db.execute(
        text(
            f"SELECT cm.id, cm.cashbox_id, cm.direction, cm.amount, cm.currency_id, "
            f"cm.description, cm.movement_date, cm.payment_type_id, "
            f"cm.customer_id, cm.supplier_id, cm.employee_id, cm.sale_id, "
            f"cb.name AS cashbox_name, "
            f"cur.code AS currency_code, "
            f"pt.name AS payment_type_name, "
            f"cu.name AS customer_name, "
            f"su.name AS supplier_name, "
            f"em.full_name AS employee_name, "
            f"sa.doc_number AS sale_doc_number, "
            f"u.full_name AS created_by_name "
            f"FROM cash_movements cm "
            f"LEFT JOIN cashboxes cb ON cb.id = cm.cashbox_id "
            f"LEFT JOIN currencies cur ON cur.id = cm.currency_id "
            f"LEFT JOIN payment_types pt ON pt.id = cm.payment_type_id "
            f"LEFT JOIN customers cu ON cu.id = cm.customer_id "
            f"LEFT JOIN suppliers su ON su.id = cm.supplier_id "
            f"LEFT JOIN employees em ON em.id = cm.employee_id "
            f"LEFT JOIN sales sa ON sa.id = cm.sale_id "
            f"LEFT JOIN users u ON u.id = cm.created_by "
            f"{where} ORDER BY cm.movement_date DESC LIMIT :lim OFFSET :off"
        ),
        params,
    )
    return [dict(r._mapping) for r in res]


@router.post("/movements", response_model=CashMovementOut, status_code=status.HTTP_201_CREATED)
async def create_movement(
    payload: CashMovementCreate,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    # HI-2: validate cashbox belongs to caller org before any DB write
    cb_check = await db.execute(
        text("SELECT 1 FROM cashboxes WHERE id = :cb AND organization_id = :o"),
        {"cb": payload.cashbox_id, "o": org_id},
    )
    if not cb_check.first():
        raise HTTPException(422, "cashbox_id does not belong to your organization")
    res = await db.execute(
        text("INSERT INTO cash_movements ("
             "organization_id, cashbox_id, direction, amount, currency_id, rate, "
             "payment_type_id, customer_id, supplier_id, employee_id, sale_id, "
             "description, created_by) "
             "VALUES (:o, :cb, :dir, :amt, :cur, :rate, :pt, :cu, :su, :em, :sa, :d, :u) "
             "RETURNING id, movement_date"),
        {"o": org_id, "cb": payload.cashbox_id, "dir": payload.direction,
         "amt": payload.amount, "cur": payload.currency_id, "rate": payload.rate,
         "pt": payload.payment_type_id,
         "cu": str(payload.customer_id) if payload.customer_id else None,
         "su": str(payload.supplier_id) if payload.supplier_id else None,
         "em": str(payload.employee_id) if payload.employee_id else None,
         "sa": str(payload.sale_id) if payload.sale_id else None,
         "d": payload.description, "u": user_id},
    )
    row = res.first()

    delta = payload.amount if payload.direction == "in" else -payload.amount
    await db.execute(
        text("UPDATE cashboxes SET balance = balance + :d WHERE id = :id"),
        {"d": delta, "id": payload.cashbox_id},
    )
    await db.commit()

    return CashMovementOut(
        id=row.id, cashbox_id=payload.cashbox_id, direction=payload.direction,
        amount=payload.amount, currency_id=payload.currency_id,
        description=payload.description, movement_date=row.movement_date,
    )


class TransferIn(BaseModel):
    from_cashbox_id: int
    to_cashbox_id: int
    amount: Decimal = Field(gt=0)
    description: str | None = None


@router.post("/transfer", status_code=status.HTTP_201_CREATED)
async def cash_transfer(
    p: TransferIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    if p.from_cashbox_id == p.to_cashbox_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Кассы совпадают")

    boxes = await db.execute(
        text("SELECT id, currency_id, balance FROM cashboxes "
             "WHERE id IN (:f, :t) AND organization_id = :o"),
        {"f": p.from_cashbox_id, "t": p.to_cashbox_id, "o": org_id},
    )
    rows = {r.id: r for r in boxes}
    if p.from_cashbox_id not in rows or p.to_cashbox_id not in rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Касса не найдена")

    desc = f"Перевод: {p.description or ''}".strip()
    # Out from source
    await db.execute(
        text("INSERT INTO cash_movements (organization_id, cashbox_id, direction, amount, "
             "currency_id, description, created_by) "
             "VALUES (:o, :cb, 'out', :amt, :cur, :d, :u)"),
        {"o": org_id, "cb": p.from_cashbox_id, "amt": p.amount,
         "cur": rows[p.from_cashbox_id].currency_id, "d": desc, "u": user_id},
    )
    # In to target
    await db.execute(
        text("INSERT INTO cash_movements (organization_id, cashbox_id, direction, amount, "
             "currency_id, description, created_by) "
             "VALUES (:o, :cb, 'in', :amt, :cur, :d, :u)"),
        {"o": org_id, "cb": p.to_cashbox_id, "amt": p.amount,
         "cur": rows[p.to_cashbox_id].currency_id, "d": desc, "u": user_id},
    )
    await db.execute(
        text("UPDATE cashboxes SET balance = balance - :a WHERE id = :id"),
        {"a": p.amount, "id": p.from_cashbox_id},
    )
    await db.execute(
        text("UPDATE cashboxes SET balance = balance + :a WHERE id = :id"),
        {"a": p.amount, "id": p.to_cashbox_id},
    )
    await db.commit()
    return {"ok": True}


# =========================================================
# SET BALANCE
# =========================================================

@router.post("/cashbox-set-balance", status_code=status.HTTP_201_CREATED)
async def cashbox_set_balance(
    payload: CashboxSetBalance,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    res = await db.execute(
        text("SELECT balance FROM cashboxes WHERE id = :id AND organization_id = :o"),
        {"id": payload.cashbox_id, "o": org_id},
    )
    row = res.first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cashbox not found")

    doc_id = uuid4()
    await db.execute(
        text("INSERT INTO cashbox_set_balance "
             "(id, organization_id, cashbox_id, old_balance, new_balance, reason, created_by) "
             "VALUES (:id, :o, :cb, :old, :new, :r, :u)"),
        {"id": str(doc_id), "o": org_id, "cb": payload.cashbox_id,
         "old": row.balance, "new": payload.new_balance,
         "r": payload.reason, "u": user_id},
    )
    await db.execute(
        text("UPDATE cashboxes SET balance = :b WHERE id = :id"),
        {"b": payload.new_balance, "id": payload.cashbox_id},
    )
    await db.commit()
    return {"id": str(doc_id), "old_balance": float(row.balance),
            "new_balance": float(payload.new_balance)}


@router.post("/entity-set-balance", status_code=status.HTTP_201_CREATED)
async def entity_set_balance(
    payload: EntitySetBalance,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    doc_id = uuid4()
    await db.execute(
        text("INSERT INTO entity_set_balance "
             "(id, organization_id, subject_type, subject_id, plan_amount, fact_amount, "
             " currency_id, notes, created_by) "
             "VALUES (:id, :o, :st, :sid, :pa, :fa, :cur, :n, :u)"),
        {"id": str(doc_id), "o": org_id, "st": payload.subject_type,
         "sid": str(payload.subject_id), "pa": payload.plan_amount,
         "fa": payload.fact_amount, "cur": payload.currency_id,
         "n": payload.notes, "u": user_id},
    )
    await db.commit()
    return {"id": str(doc_id), "diff": float(payload.fact_amount - payload.plan_amount)}


# =========================================================
# EXTRA COSTS
# =========================================================

@router.get("/extra-costs")
async def list_extra_costs(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    where = "WHERE ec.organization_id = :o"
    params: dict = {"o": org_id}
    if date_from:
        where += " AND ec.cost_date >= :df"
        params["df"] = date_from
    if date_to:
        where += " AND ec.cost_date <= :dt"
        params["dt"] = date_to
    res = await db.execute(
        text(f"SELECT ec.id, ec.cost_date, ec.category, ec.amount, ec.description, "
             f"cb.name AS cashbox_name, cur.code AS currency_code "
             f"FROM extra_costs ec "
             f"LEFT JOIN cashboxes cb ON cb.id = ec.cashbox_id "
             f"LEFT JOIN currencies cur ON cur.id = ec.currency_id "
             f"{where} ORDER BY ec.cost_date DESC, ec.created_at DESC LIMIT 200"),
        params,
    )
    return [dict(r._mapping) for r in res]


@router.post("/extra-costs", status_code=status.HTTP_201_CREATED)
async def create_extra_cost(
    payload: ExtraCostCreate,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    doc_id = uuid4()
    await db.execute(
        text("INSERT INTO extra_costs "
             "(id, organization_id, cost_date, category, amount, currency_id, cashbox_id, "
             " description, created_by) "
             "VALUES (:id, :o, :d, :c, :a, :cur, :cb, :desc, :u)"),
        {"id": str(doc_id), "o": org_id, "d": payload.cost_date,
         "c": payload.category, "a": payload.amount, "cur": payload.currency_id,
         "cb": payload.cashbox_id, "desc": payload.description, "u": user_id},
    )
    if payload.cashbox_id:
        await db.execute(
            text("INSERT INTO cash_movements (organization_id, cashbox_id, direction, "
                 "amount, currency_id, description, created_by) "
                 "VALUES (:o, :cb, 'out', :a, :cur, :d, :u)"),
            {"o": org_id, "cb": payload.cashbox_id, "a": payload.amount,
             "cur": payload.currency_id,
             "d": f"Доп. расход: {payload.category} — {payload.description or ''}".strip(),
             "u": user_id},
        )
        await db.execute(
            text("UPDATE cashboxes SET balance = balance - :a WHERE id = :id"),
            {"a": payload.amount, "id": payload.cashbox_id},
        )
    await db.commit()
    return {"id": str(doc_id)}


@router.delete("/extra-costs/{eid}")
async def delete_extra_cost(
    eid: UUID, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await db.execute(
        text("DELETE FROM extra_costs WHERE id = :id AND organization_id = :o"),
        {"id": str(eid), "o": org_id},
    )
    await db.commit()
    return {"ok": True}


# =========================================================
# REPORTS — TURNOVER (per entity type)
# =========================================================

@router.get("/turnover")
async def cashbox_turnover(
    date_from: date = Query(...),
    date_to: date = Query(...),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT cb.id AS cashbox_id, cb.name AS cashbox_name, cm.direction, "
             "SUM(cm.amount) AS total, COUNT(*) AS cnt "
             "FROM cash_movements cm "
             "LEFT JOIN cashboxes cb ON cb.id = cm.cashbox_id "
             "WHERE cm.organization_id = :o "
             "  AND cm.movement_date >= :df "
             "  AND cm.movement_date < (CAST(:dt AS date) + INTERVAL '1 day') "
             "GROUP BY cb.id, cb.name, cm.direction "
             "ORDER BY cb.name, cm.direction"),
        {"o": org_id, "df": date_from, "dt": date_to},
    )
    return [dict(r._mapping) for r in res]


def _entity_turnover_sql(subject_col: str, entity_table: str) -> str:
    return f"""
    SELECT e.id AS entity_id, e.name AS entity_name,
           SUM(CASE WHEN cm.direction='in' THEN cm.amount ELSE 0 END) AS total_in,
           SUM(CASE WHEN cm.direction='out' THEN cm.amount ELSE 0 END) AS total_out,
           SUM(CASE WHEN cm.direction='in' THEN cm.amount ELSE -cm.amount END) AS net,
           COUNT(*) AS cnt
    FROM cash_movements cm
    JOIN {entity_table} e ON e.id = cm.{subject_col}
    WHERE cm.organization_id = :o
      AND cm.movement_date >= :df
      AND cm.movement_date < (CAST(:dt AS date) + INTERVAL '1 day')
      AND cm.{subject_col} IS NOT NULL
    GROUP BY e.id, e.name
    ORDER BY ABS(SUM(CASE WHEN cm.direction='in' THEN cm.amount ELSE -cm.amount END)) DESC
    LIMIT 200
    """


@router.get("/customer-turnover")
async def customer_turnover(
    date_from: date = Query(...),
    date_to: date = Query(...),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text(_entity_turnover_sql("customer_id", "customers")),
        {"o": org_id, "df": date_from, "dt": date_to},
    )
    return [dict(r._mapping) for r in res]


@router.get("/supplier-turnover")
async def supplier_turnover(
    date_from: date = Query(...),
    date_to: date = Query(...),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text(_entity_turnover_sql("supplier_id", "suppliers")),
        {"o": org_id, "df": date_from, "dt": date_to},
    )
    return [dict(r._mapping) for r in res]


@router.get("/employee-turnover")
async def employee_turnover(
    date_from: date = Query(...),
    date_to: date = Query(...),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("""
        SELECT e.id AS entity_id, e.full_name AS entity_name,
               SUM(CASE WHEN cm.direction='in' THEN cm.amount ELSE 0 END) AS total_in,
               SUM(CASE WHEN cm.direction='out' THEN cm.amount ELSE 0 END) AS total_out,
               SUM(CASE WHEN cm.direction='in' THEN cm.amount ELSE -cm.amount END) AS net,
               COUNT(*) AS cnt
        FROM cash_movements cm
        JOIN employees e ON e.id = cm.employee_id
        WHERE cm.organization_id = :o
          AND cm.movement_date >= :df
          AND cm.movement_date < (CAST(:dt AS date) + INTERVAL '1 day')
          AND cm.employee_id IS NOT NULL
        GROUP BY e.id, e.full_name
        ORDER BY ABS(SUM(CASE WHEN cm.direction='in' THEN cm.amount ELSE -cm.amount END)) DESC
        LIMIT 200
        """),
        {"o": org_id, "df": date_from, "dt": date_to},
    )
    return [dict(r._mapping) for r in res]


# =========================================================
# REPORTS — STATISTICS
# =========================================================

@router.get("/cash-flow")
async def cash_flow_statistics(
    date_from: date = Query(...),
    date_to: date = Query(...),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    daily = await db.execute(
        text("SELECT movement_date::date AS day, "
             "SUM(CASE WHEN direction='in' THEN amount ELSE 0 END) AS inflow, "
             "SUM(CASE WHEN direction='out' THEN amount ELSE 0 END) AS outflow "
             "FROM cash_movements "
             "WHERE organization_id = :o "
             "  AND movement_date >= :df "
             "  AND movement_date < (CAST(:dt AS date) + INTERVAL '1 day') "
             "GROUP BY 1 ORDER BY 1"),
        {"o": org_id, "df": date_from, "dt": date_to},
    )

    by_pt = await db.execute(
        text("SELECT pt.name AS payment_type, direction, SUM(cm.amount) AS total "
             "FROM cash_movements cm "
             "LEFT JOIN payment_types pt ON pt.id = cm.payment_type_id "
             "WHERE cm.organization_id = :o "
             "  AND cm.movement_date >= :df "
             "  AND cm.movement_date < (CAST(:dt AS date) + INTERVAL '1 day') "
             "GROUP BY pt.name, direction ORDER BY pt.name, direction"),
        {"o": org_id, "df": date_from, "dt": date_to},
    )

    return {
        "daily": [dict(r._mapping) for r in daily],
        "by_payment_type": [dict(r._mapping) for r in by_pt],
    }


@router.get("/balance-statistics")
async def balance_statistics(
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    cashboxes = await db.execute(
        text("SELECT cb.name, cb.balance, cur.code FROM cashboxes cb "
             "LEFT JOIN currencies cur ON cur.id = cb.currency_id "
             "WHERE cb.organization_id = :o AND cb.is_active = TRUE"),
        {"o": org_id},
    )
    customers = await db.execute(
        text("SELECT COUNT(*) FILTER (WHERE balance < 0) AS debtors, "
             "COUNT(*) FILTER (WHERE balance > 0) AS overpayers, "
             "COALESCE(SUM(balance), 0) AS net "
             "FROM v_customer_balance WHERE organization_id = :o"),
        {"o": org_id},
    )
    return {
        "cashboxes": [dict(r._mapping) for r in cashboxes],
        "customers": dict(customers.first()._mapping),
    }


@router.get("/price-deviation")
async def price_deviation_report(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    where = "WHERE s.organization_id = :o AND s.status <> 'cancelled' " \
            "AND ABS(si.price - p.sale_price) > 0.01"
    params: dict = {"o": org_id}
    if date_from:
        where += " AND s.sale_date >= :df"
        params["df"] = date_from
    if date_to:
        where += " AND s.sale_date < (CAST(:dt AS date) + INTERVAL '1 day')"
        params["dt"] = date_to
    res = await db.execute(
        text(f"SELECT s.id AS sale_id, s.doc_number, s.sale_date, "
             f"p.name AS product_name, p.sale_price AS plan_price, "
             f"si.price AS fact_price, "
             f"(si.price - p.sale_price) AS deviation, "
             f"si.quantity, "
             f"((si.price - p.sale_price) * si.quantity) AS impact "
             f"FROM sale_items si "
             f"JOIN sales s ON s.id = si.sale_id "
             f"JOIN products p ON p.id = si.product_id "
             f"{where} ORDER BY ABS(si.price - p.sale_price) DESC LIMIT 200"),
        params,
    )
    return [dict(r._mapping) for r in res]


# =========================================================
# ENTITY BALANCE (employee + person)
# =========================================================

@router.get("/employee-balance")
async def employee_balances(
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("""
        SELECT e.id, e.full_name AS name,
               COALESCE(SUM(CASE WHEN cm.direction='in' THEN cm.amount ELSE -cm.amount END), 0) AS balance
        FROM employees e
        LEFT JOIN cash_movements cm ON cm.employee_id = e.id
        WHERE e.organization_id = :o AND e.is_active = TRUE
        GROUP BY e.id, e.full_name
        ORDER BY e.full_name
        """),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


# Person = general physical person (subject_type='person'), no separate table
@router.get("/person-balance")
async def person_balances(
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("""
        SELECT subject_id AS id,
               COALESCE(SUM(fact_amount - plan_amount), 0) AS balance,
               MAX(start_date) AS last_op
        FROM entity_set_balance
        WHERE organization_id = :o AND subject_type = 'person'
        GROUP BY subject_id
        ORDER BY last_op DESC
        """),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


# =========================================================
# 1C BUXGALTERIYA EXPORT
# =========================================================

@router.get(
    "/export/1c-csv",
    dependencies=[Depends(require_permission("finance.export_1c"))],
)
async def export_1c_csv(
    date_from: date = Query(...),
    date_to: date = Query(...),
    type: ExportType = Query("all"),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    data, ctype, filename = await build_export(
        db, org_id, date_from, date_to, type, "csv"
    )
    return Response(
        content=data,
        media_type=ctype,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/export/1c-xml",
    dependencies=[Depends(require_permission("finance.export_1c"))],
)
async def export_1c_xml(
    date_from: date = Query(...),
    date_to: date = Query(...),
    type: ExportType = Query("all"),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    data, ctype, filename = await build_export(
        db, org_id, date_from, date_to, type, "xml"
    )
    return Response(
        content=data,
        media_type=ctype,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# =========================================================
# BILL PAYMENT (Click utility bills)
# =========================================================

class BillPaymentIn(BaseModel):
    bill_type: Literal["electricity", "gas", "water", "internet", "phone"]
    account_number: str = Field(min_length=1, max_length=64)
    amount: Decimal = Field(gt=0)
    customer_id: UUID | None = None


_BILL_TYPE_TO_SERVICE: dict[str, str] = {
    "electricity": "elektr",
    "gas": "gaz",
    "water": "suv",
    "internet": "internet",
    "phone": "telefon",
}


@router.post(
    "/bill-payment",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("finance.bill_payment"))],
)
async def create_bill_payment(
    payload: BillPaymentIn,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    _user_id: str = Depends(get_current_user_id),
):
    # Idempotency: return cached result for repeat requests within 24h
    if idempotency_key:
        cached = await db.execute(
            text("""
                SELECT id, status, provider_tx_id
                FROM payment_transactions
                WHERE organization_id = :o
                  AND provider = 'click_bill'
                  AND provider_tx_id = :k
                  AND created_at >= NOW() - INTERVAL '24 hours'
            """),
            {"o": org_id, "k": f"idem:{idempotency_key}"},
        )
        existing = cached.first()
        if existing:
            return {
                "transaction_id": str(existing.id),
                "status": existing.status,
                "provider_ref": existing.provider_tx_id,
            }

    cfg = await get_payment_settings(db, org_id, "click")
    if not cfg.get("enabled"):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Click to'lov tizimi yoqilmagan. Sozlamalardan Click'ni faollashtiring.",
        )

    service_id = _BILL_TYPE_TO_SERVICE[payload.bill_type]
    idem_ref = f"idem:{idempotency_key}" if idempotency_key else None

    link_result = await create_bill_payment_link(
        org_id=org_id,
        service_id=service_id,
        account=payload.account_number,
        amount=payload.amount,
        return_url="",
        db=db,
    )

    tx_id = uuid4()
    await db.execute(
        text("""
            INSERT INTO payment_transactions
                (id, organization_id, provider, provider_tx_id, amount, status,
                 customer_id, provider_data)
            VALUES (:id, :o, 'click_bill', :ptx, :amt, 'pending',
                    :cu, CAST(:pd AS jsonb))
        """),
        {
            "id": str(tx_id),
            "o": org_id,
            "ptx": idem_ref or link_result["invoice_id"],
            "amt": payload.amount,
            "cu": str(payload.customer_id) if payload.customer_id else None,
            "pd": json.dumps({
                "bill_type": payload.bill_type,
                "account_number": payload.account_number,
                "service_id": service_id,
                "invoice_id": link_result["invoice_id"],
                "payment_url": link_result["payment_url"],
                "expires_at": link_result["expires_at"],
            }),
        },
    )
    await db.commit()

    return {
        "transaction_id": str(tx_id),
        "status": "pending",
        "provider_ref": link_result["invoice_id"],
    }


# =========================================================
# SMS DEBT REMINDER  (T-132)
# =========================================================

_SMS_DEFAULT_TEMPLATE = (
    "Hurmatli {ism}, sizning qarzdorligingiz: {summa} so'm. "
    "Iltimos, to'lovni amalga oshiring. Aniq ERP"
)
_SMS_MAX_LEN = 480  # 3 SMS parts


class DebtReminderIn(BaseModel):
    message_template: Literal["default", "custom"] = "default"
    custom_text: str | None = Field(None, max_length=_SMS_MAX_LEN)


async def _get_eskiz_creds(db: AsyncSession, org_id: str) -> tuple[str, str]:
    """Read decrypted Eskiz credentials from app_settings. Returns (email, password)."""
    res = await db.execute(
        text(
            "SELECT value FROM app_settings "
            "WHERE organization_id = :o AND key = 'integrations'"
        ),
        {"o": org_id},
    )
    row = res.first()
    if not row or not row.value:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="sms_not_configured")
    cfg = row.value if isinstance(row.value, dict) else json.loads(row.value)
    eskiz_cfg = cfg.get("eskiz") or {}
    if not eskiz_cfg.get("enabled"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="sms_not_configured")
    email = eskiz_cfg.get("email") or ""
    password_enc = eskiz_cfg.get("password") or ""
    if not email or not password_enc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="sms_not_configured")
    try:
        password = secret_box.decrypt(password_enc)
    except Exception:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="sms_not_configured")
    return email, password


@router.post(
    "/debtors/{customer_id}/send-sms",
    dependencies=[Depends(require_permission("finance.send_sms"))],
)
async def send_debt_reminder(
    customer_id: UUID,
    payload: DebtReminderIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    # 1. Validate customer belongs to org and get phone + name
    cust_res = await db.execute(
        text(
            "SELECT id, name, phone FROM customers "
            "WHERE id = :cid AND organization_id = :o"
        ),
        {"cid": str(customer_id), "o": org_id},
    )
    cust = cust_res.first()
    if not cust:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="customer_not_found")
    if not cust.phone:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="phone_missing")

    phone = cust.phone

    # 2. Rate limit: max 1 SMS per customer per hour (manual check — slowapi
    #    key_func doesn't have DB access; using a DB timestamp guard instead)
    rate_res = await db.execute(
        text(
            "SELECT COUNT(*) FROM sms_debt_reminders "
            "WHERE organization_id = :o AND customer_id = :cid "
            "AND sent_at >= NOW() - INTERVAL '1 hour' AND status = 'sent'"
        ),
        {"o": org_id, "cid": str(customer_id)},
    )
    if (rate_res.scalar() or 0) >= 1:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            detail="rate_limit: max 1 SMS per customer per hour",
        )

    # 3. Daily user rate limit: max 30 SMS per user per day
    daily_res = await db.execute(
        text(
            "SELECT COUNT(*) FROM sms_debt_reminders "
            "WHERE organization_id = :o AND user_id = :uid "
            "AND sent_at >= NOW() - INTERVAL '24 hours' AND status = 'sent'"
        ),
        {"o": org_id, "uid": user_id},
    )
    if (daily_res.scalar() or 0) >= 30:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            detail="rate_limit: max 30 SMS per user per day",
        )

    # 4. Fetch real-time debt balance from DB (v_customer_balance view)
    bal_res = await db.execute(
        text(
            "SELECT COALESCE(balance, 0) AS balance FROM v_customer_balance "
            "WHERE id = :cid AND organization_id = :o"
        ),
        {"cid": str(customer_id), "o": org_id},
    )
    bal_row = bal_res.first()
    debt_amount = abs(bal_row.balance) if bal_row else 0

    # 5. Build message text
    if payload.message_template == "custom":
        if not payload.custom_text:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="custom_text required when message_template=custom",
            )
        message_text = payload.custom_text
    else:
        message_text = _SMS_DEFAULT_TEMPLATE.format(
            ism=cust.name or "Mijoz",
            summa=f"{debt_amount:,.0f}",
        )

    if len(message_text) > _SMS_MAX_LEN:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"message too long: max {_SMS_MAX_LEN} characters",
        )

    # 6. Read Eskiz credentials and send
    email, password = await _get_eskiz_creds(db, org_id)

    log_id = str(uuid4())
    provider_message_id = None
    sms_status = "failed"
    error_text = None

    try:
        result = await eskiz_sms.send_sms(email, password, phone, message_text)
        # Eskiz returns {"id": ..., "status": "waiting"} on success
        provider_message_id = str(result.get("id") or result.get("message_id") or "")
        sms_status = "sent"
    except Exception as exc:
        error_text = str(exc)[:500]
        log.warning("eskiz sms failed org=%s customer=%s err=%s", org_id, customer_id, error_text)

    # 7. Log to sms_debt_reminders
    await db.execute(
        text(
            "INSERT INTO sms_debt_reminders "
            "(id, organization_id, customer_id, user_id, phone, message, "
            " status, provider_message_id, error) "
            "VALUES (:id, :o, :cid, :uid, :ph, :msg, :st, :pmid, :err)"
        ),
        {
            "id": log_id,
            "o": org_id,
            "cid": str(customer_id),
            "uid": user_id,
            "ph": phone,
            "msg": message_text,
            "st": sms_status,
            "pmid": provider_message_id or None,
            "err": error_text,
        },
    )
    await db.commit()

    if sms_status == "failed":
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            detail=f"sms_send_failed: {error_text}",
        )

    return {
        "sent": True,
        "phone": phone,
        "message_id": provider_message_id or None,
    }


@router.get(
    "/debtors/{customer_id}/sms-log",
    dependencies=[Depends(require_permission("finance.send_sms"))],
)
async def list_sms_log(
    customer_id: UUID,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    # Validate customer belongs to org
    cust_res = await db.execute(
        text("SELECT id FROM customers WHERE id = :cid AND organization_id = :o"),
        {"cid": str(customer_id), "o": org_id},
    )
    if not cust_res.first():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="customer_not_found")

    res = await db.execute(
        text(
            "SELECT id, phone, message, status, provider_message_id, error, sent_at "
            "FROM sms_debt_reminders "
            "WHERE organization_id = :o AND customer_id = :cid "
            "ORDER BY sent_at DESC LIMIT :lim"
        ),
        {"o": org_id, "cid": str(customer_id), "lim": limit},
    )
    rows = res.fetchall()
    return [
        {
            "id": str(r.id),
            "phone": r.phone,
            "message": r.message,
            "status": r.status,
            "provider_message_id": r.provider_message_id,
            "error": r.error,
            "sent_at": r.sent_at.isoformat() if r.sent_at else None,
        }
        for r in rows
    ]
