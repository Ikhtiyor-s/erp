from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_org_id


router = APIRouter(prefix="/hr", tags=["hr"])


# =========================================================
# POSITIONS
# =========================================================

class PositionIn(BaseModel):
    name: str
    description: str | None = None


@router.get("/positions")
async def list_positions(
    db: AsyncSession = Depends(get_db), org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT p.id, p.name, p.description, "
             "(SELECT COUNT(*) FROM employees e WHERE e.position_id = p.id AND e.is_active = TRUE) AS employee_count, "
             "(SELECT COALESCE(AVG(e.salary), 0) FROM employees e WHERE e.position_id = p.id AND e.is_active = TRUE AND e.salary IS NOT NULL) AS avg_salary "
             "FROM positions p WHERE p.organization_id = :o ORDER BY p.name"),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


@router.post("/positions", status_code=status.HTTP_201_CREATED)
async def create_position(
    p: PositionIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("INSERT INTO positions (organization_id, name, description) "
             "VALUES (:o, :n, :d) RETURNING id"),
        {"o": org_id, "n": p.name, "d": p.description},
    )
    await db.commit()
    return {"id": res.scalar()}


@router.put("/positions/{pid}")
async def update_position(
    pid: int, p: PositionIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("UPDATE positions SET name=:n, description=:d "
             "WHERE id = :id AND organization_id = :o RETURNING id"),
        {"id": pid, "o": org_id, "n": p.name, "d": p.description},
    )
    if not res.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    await db.commit()
    return {"ok": True}


@router.delete("/positions/{pid}")
async def delete_position(
    pid: int, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await db.execute(
        text("DELETE FROM positions WHERE id = :id AND organization_id = :o"),
        {"id": pid, "o": org_id},
    )
    await db.commit()
    return {"ok": True}


# =========================================================
# EMPLOYEES
# =========================================================

class EmployeeIn(BaseModel):
    full_name: str
    position_id: int | None = None
    phone: str | None = None
    email: str | None = None
    salary: Decimal | None = None
    salary_currency: int | None = None
    hire_date: date | None = None
    location_id: int | None = None


@router.get("/employees")
async def list_employees(
    q: str | None = None,
    position_id: int | None = None,
    location_id: int | None = None,
    db: AsyncSession = Depends(get_db), org_id: str = Depends(get_current_org_id),
):
    where = "WHERE e.organization_id = :o AND e.is_active = TRUE"
    params: dict = {"o": org_id}
    if q:
        where += " AND (e.full_name ILIKE :q OR e.phone ILIKE :q OR e.email ILIKE :q)"
        params["q"] = f"%{q}%"
    if position_id:
        where += " AND e.position_id = :pos"
        params["pos"] = position_id
    if location_id:
        where += " AND e.location_id = :loc"
        params["loc"] = location_id
    res = await db.execute(
        text(f"SELECT e.id, e.full_name, e.position_id, p.name AS position_name, "
             f"('A' || SUBSTRING(e.id::text, 1, 8)) AS uuid_label, "
             f"e.phone, e.email, e.salary, e.salary_currency, e.hire_date, "
             f"cur.code AS currency_code, "
             f"e.location_id, l.name AS location_name, "
             f"COALESCE((SELECT SUM(CASE WHEN direction='in' THEN amount ELSE -amount END) "
             f"          FROM cash_movements WHERE employee_id = e.id), 0) AS balance "
             f"FROM employees e "
             f"LEFT JOIN positions p ON p.id = e.position_id "
             f"LEFT JOIN currencies cur ON cur.id = e.salary_currency "
             f"LEFT JOIN locations l ON l.id = e.location_id "
             f"{where} ORDER BY e.full_name"),
        params,
    )
    return [dict(r._mapping) for r in res]


@router.post("/employees", status_code=status.HTTP_201_CREATED)
async def create_employee(
    p: EmployeeIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    eid = uuid4()
    await db.execute(
        text("INSERT INTO employees (id, organization_id, full_name, position_id, phone, email, "
             "salary, salary_currency, hire_date, location_id) "
             "VALUES (:id, :o, :n, :pos, :ph, :e, :s, :sc, :hd, :loc)"),
        {"id": str(eid), "o": org_id, "n": p.full_name, "pos": p.position_id,
         "ph": p.phone, "e": p.email, "s": p.salary, "sc": p.salary_currency, "hd": p.hire_date,
         "loc": p.location_id},
    )
    await db.commit()
    return {"id": str(eid)}


@router.put("/employees/{eid}")
async def update_employee(
    eid: UUID, p: EmployeeIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("UPDATE employees SET full_name=:n, position_id=:pos, phone=:ph, email=:e, "
             "salary=:s, salary_currency=:sc, hire_date=:hd, location_id=:loc "
             "WHERE id = :id AND organization_id = :o RETURNING id"),
        {"id": str(eid), "o": org_id, "n": p.full_name, "pos": p.position_id,
         "ph": p.phone, "e": p.email, "s": p.salary, "sc": p.salary_currency, "hd": p.hire_date,
         "loc": p.location_id},
    )
    if not res.scalar():
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    await db.commit()
    return {"ok": True}


@router.delete("/employees/{eid}")
async def delete_employee(
    eid: UUID, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await db.execute(
        text("UPDATE employees SET is_active = FALSE, fire_date = CURRENT_DATE "
             "WHERE id = :id AND organization_id = :o"),
        {"id": str(eid), "o": org_id},
    )
    await db.commit()
    return {"ok": True}


@router.get("/employees/{eid}")
async def employee_profile(
    eid: UUID, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    head = await db.execute(
        text("SELECT e.*, p.name AS position_name, cur.code AS currency_code "
             "FROM employees e "
             "LEFT JOIN positions p ON p.id = e.position_id "
             "LEFT JOIN currencies cur ON cur.id = e.salary_currency "
             "WHERE e.id = :id AND e.organization_id = :o"),
        {"id": str(eid), "o": org_id},
    )
    h = head.first()
    if not h:
        raise HTTPException(status.HTTP_404_NOT_FOUND)

    balance = await db.execute(
        text("SELECT COALESCE(SUM(CASE WHEN direction='in' THEN amount ELSE -amount END), 0) AS bal, "
             "COUNT(*) AS cnt "
             "FROM cash_movements WHERE employee_id = :id"),
        {"id": str(eid)},
    )

    productions = await db.execute(
        text("SELECT COUNT(*) AS orders_cnt, "
             "COALESCE(SUM(produced_qty), 0) AS produced, "
             "COUNT(*) FILTER (WHERE status='completed') AS completed_cnt "
             "FROM production_orders WHERE responsible_id = :id AND organization_id = :o"),
        {"id": str(eid), "o": org_id},
    )

    kpis = await db.execute(
        text("SELECT period_month, metric, target_value, actual_value, notes "
             "FROM kpi_entries WHERE employee_id = :id "
             "ORDER BY period_month DESC LIMIT 24"),
        {"id": str(eid)},
    )

    movements = await db.execute(
        text("SELECT cm.id, cm.direction, cm.amount, cm.description, cm.movement_date, "
             "cb.name AS cashbox_name, cur.code AS currency_code, "
             "pt.name AS payment_type_name "
             "FROM cash_movements cm "
             "LEFT JOIN cashboxes cb ON cb.id = cm.cashbox_id "
             "LEFT JOIN currencies cur ON cur.id = cm.currency_id "
             "LEFT JOIN payment_types pt ON pt.id = cm.payment_type_id "
             "WHERE cm.employee_id = :id "
             "ORDER BY cm.movement_date DESC LIMIT 50"),
        {"id": str(eid)},
    )

    return {
        "head": dict(h._mapping),
        "balance": dict(balance.first()._mapping),
        "productions": dict(productions.first()._mapping),
        "kpis": [dict(r._mapping) for r in kpis],
        "movements": [dict(r._mapping) for r in movements],
    }


# =========================================================
# ROLES
# =========================================================

@router.get("/roles")
async def list_roles(db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        text("SELECT id, code, name, description FROM roles ORDER BY id"),
    )
    return [dict(r._mapping) for r in res]


# =========================================================
# KPI
# =========================================================

class KpiIn(BaseModel):
    employee_id: UUID
    period_month: date  # YYYY-MM-DD (first day of month)
    metric: str
    target_value: Decimal | None = None
    actual_value: Decimal | None = None
    notes: str | None = None


@router.get("/kpi")
async def list_kpi(
    employee_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    where = "WHERE k.organization_id = :o"
    params: dict = {"o": org_id}
    if employee_id:
        where += " AND k.employee_id = :eid"
        params["eid"] = str(employee_id)
    res = await db.execute(
        text(f"SELECT k.id, k.employee_id, e.full_name AS employee_name, "
             f"k.period_month, k.metric, k.target_value, k.actual_value, k.notes "
             f"FROM kpi_entries k "
             f"LEFT JOIN employees e ON e.id = k.employee_id "
             f"{where} ORDER BY k.period_month DESC, e.full_name LIMIT 500"),
        params,
    )
    return [dict(r._mapping) for r in res]


@router.post("/kpi", status_code=status.HTTP_201_CREATED)
async def upsert_kpi(
    p: KpiIn, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("INSERT INTO kpi_entries (organization_id, employee_id, period_month, metric, "
             "target_value, actual_value, notes) "
             "VALUES (:o, :e, :pm, :m, :t, :a, :n) "
             "ON CONFLICT (employee_id, period_month, metric) DO UPDATE "
             "SET target_value = EXCLUDED.target_value, "
             "    actual_value = EXCLUDED.actual_value, "
             "    notes = EXCLUDED.notes "
             "RETURNING id"),
        {"o": org_id, "e": str(p.employee_id), "pm": p.period_month, "m": p.metric,
         "t": p.target_value, "a": p.actual_value, "n": p.notes},
    )
    await db.commit()
    return {"id": res.scalar()}


@router.delete("/kpi/{kid}")
async def delete_kpi(
    kid: int, db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await db.execute(
        text("DELETE FROM kpi_entries WHERE id = :id AND organization_id = :o"),
        {"id": kid, "o": org_id},
    )
    await db.commit()
    return {"ok": True}
