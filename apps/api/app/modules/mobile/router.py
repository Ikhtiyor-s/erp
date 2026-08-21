"""
Mobile/Bito-parity feature endpoints:
- Tags (universal)
- Custom fields (universal)
- Installment plans
- Cashbox sessions (smena)
- Open tickets (cafe/restaurant)
- Distribution/Visits
- Courier tracking
- Delivery orders
- Push tokens (FCM)
- Passcode auth
- POS pages (predefined buttons)
- File attachments
"""
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, status
from passlib.context import CryptContext
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_org_id, get_current_user_id, get_db
from app.core.rate_limit import limiter

router = APIRouter(tags=["mobile"])

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


# =========================================================
# TAGS
# =========================================================

class TagIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    color: str = "#3393cb"


@router.get("/tags")
async def list_tags(
    entity_type: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT id, name, color FROM tags WHERE organization_id = :o ORDER BY name"),
        {"o": org_id},
    )
    tags = [dict(r._mapping) for r in res]
    if entity_type:
        for t in tags:
            cnt = await db.execute(
                text("SELECT COUNT(*) FROM entity_tags WHERE tag_id = :t AND entity_type = :e"),
                {"t": t["id"], "e": entity_type},
            )
            t["usage_count"] = cnt.scalar() or 0
    return tags


@router.post("/tags", status_code=status.HTTP_201_CREATED)
async def create_tag(
    t: TagIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("INSERT INTO tags (organization_id, name, color) VALUES (:o, :n, :c) "
             "ON CONFLICT (organization_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id"),
        {"o": org_id, "n": t.name, "c": t.color},
    )
    await db.commit()
    return {"id": res.scalar()}


@router.delete("/tags/{tag_id}")
async def delete_tag(
    tag_id: int,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await db.execute(
        text("DELETE FROM tags WHERE id = :i AND organization_id = :o"),
        {"i": tag_id, "o": org_id},
    )
    await db.commit()
    return {"ok": True}


@router.get("/entity-tags/{entity_type}/{entity_id}")
async def get_entity_tags(
    entity_type: str, entity_id: str,
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        text("SELECT t.id, t.name, t.color FROM tags t "
             "JOIN entity_tags et ON et.tag_id = t.id "
             "WHERE et.entity_type = :et AND et.entity_id = :ei"),
        {"et": entity_type, "ei": entity_id},
    )
    return [dict(r._mapping) for r in res]


class EntityTagsSet(BaseModel):
    tag_ids: list[int]


@router.post("/entity-tags/{entity_type}/{entity_id}")
async def set_entity_tags(
    entity_type: str, entity_id: str, payload: EntityTagsSet,
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        text("DELETE FROM entity_tags WHERE entity_type=:et AND entity_id=:ei"),
        {"et": entity_type, "ei": entity_id},
    )
    for tid in payload.tag_ids:
        await db.execute(
            text("INSERT INTO entity_tags (tag_id, entity_type, entity_id) "
                 "VALUES (:t, :et, :ei) ON CONFLICT DO NOTHING"),
            {"t": tid, "et": entity_type, "ei": entity_id},
        )
    await db.commit()
    return {"ok": True}


# =========================================================
# CUSTOM FIELDS
# =========================================================

class CustomFieldIn(BaseModel):
    entity_type: str
    name: str
    field_type: str = "text"  # text|number|date|select|bool
    options: list[str] = []
    required: bool = False
    sort_order: int = 0


@router.get("/custom-fields")
async def list_custom_fields(
    entity_type: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    where = "WHERE organization_id = :o AND is_active"
    params: dict = {"o": org_id}
    if entity_type:
        where += " AND entity_type = :et"
        params["et"] = entity_type
    res = await db.execute(
        text(f"SELECT id, entity_type, name, field_type, options, required, sort_order "
             f"FROM custom_fields {where} ORDER BY sort_order, name"),
        params,
    )
    return [dict(r._mapping) for r in res]


@router.post("/custom-fields", status_code=status.HTTP_201_CREATED)
async def create_custom_field(
    f: CustomFieldIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("INSERT INTO custom_fields (organization_id, entity_type, name, field_type, options, required, sort_order) "
             "VALUES (:o, :et, :n, :ft, :opt::jsonb, :req, :so) "
             "ON CONFLICT (organization_id, entity_type, name) DO UPDATE SET "
             "field_type = EXCLUDED.field_type, options = EXCLUDED.options, required = EXCLUDED.required "
             "RETURNING id"),
        {"o": org_id, "et": f.entity_type, "n": f.name, "ft": f.field_type,
         "opt": __import__("json").dumps(f.options), "req": f.required, "so": f.sort_order},
    )
    await db.commit()
    return {"id": res.scalar()}


@router.delete("/custom-fields/{field_id}")
async def delete_custom_field(
    field_id: int,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    await db.execute(
        text("UPDATE custom_fields SET is_active = FALSE WHERE id = :i AND organization_id = :o"),
        {"i": field_id, "o": org_id},
    )
    await db.commit()
    return {"ok": True}


class CustomFieldValuesIn(BaseModel):
    values: dict[int, str | None]  # field_id -> value


@router.get("/custom-field-values/{entity_type}/{entity_id}")
async def get_cfv(
    entity_type: str, entity_id: str,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT cf.id AS field_id, cf.name, cf.field_type, cf.options, cfv.value "
             "FROM custom_fields cf "
             "LEFT JOIN custom_field_values cfv ON cfv.field_id = cf.id "
             "  AND cfv.entity_type = :et AND cfv.entity_id = :ei "
             "WHERE cf.organization_id = :o AND cf.entity_type = :et AND cf.is_active "
             "ORDER BY cf.sort_order, cf.name"),
        {"o": org_id, "et": entity_type, "ei": entity_id},
    )
    return [dict(r._mapping) for r in res]


@router.post("/custom-field-values/{entity_type}/{entity_id}")
async def set_cfv(
    entity_type: str, entity_id: str, payload: CustomFieldValuesIn,
    db: AsyncSession = Depends(get_db),
):
    for fid, val in payload.values.items():
        if val is None or val == "":
            await db.execute(
                text("DELETE FROM custom_field_values WHERE field_id=:f AND entity_type=:et AND entity_id=:ei"),
                {"f": fid, "et": entity_type, "ei": entity_id},
            )
        else:
            await db.execute(
                text("INSERT INTO custom_field_values (field_id, entity_type, entity_id, value) "
                     "VALUES (:f, :et, :ei, :v) "
                     "ON CONFLICT (field_id, entity_type, entity_id) DO UPDATE SET value = EXCLUDED.value"),
                {"f": fid, "et": entity_type, "ei": entity_id, "v": val},
            )
    await db.commit()
    return {"ok": True}


# =========================================================
# INSTALLMENT PLANS
# =========================================================

class InstallmentIn(BaseModel):
    sale_id: UUID
    customer_id: UUID
    total_amount: Decimal
    currency_id: int
    months: int = Field(ge=1, le=60)
    interest_pct: Decimal = Decimal("0")
    start_date: date
    notes: str | None = None


@router.get("/installments")
async def list_installments(
    status_f: str | None = Query(None, alias="status"),
    customer_id: UUID | None = Query(None),
    limit: int = 50, offset: int = 0,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    where = "WHERE p.organization_id = :o"
    params: dict = {"o": org_id, "lim": limit, "off": offset}
    if status_f:
        where += " AND p.status = :s"
        params["s"] = status_f
    if customer_id:
        where += " AND p.customer_id = :c"
        params["c"] = str(customer_id)
    res = await db.execute(
        text(f"SELECT p.*, c.name AS customer_name, "
             f"(SELECT COUNT(*) FROM installment_schedules WHERE plan_id = p.id) AS schedule_count, "
             f"(SELECT COUNT(*) FROM installment_schedules WHERE plan_id = p.id AND status = 'paid') AS paid_count "
             f"FROM installment_plans p "
             f"LEFT JOIN customers c ON c.id = p.customer_id "
             f"{where} ORDER BY p.start_date DESC LIMIT :lim OFFSET :off"),
        params,
    )
    return [dict(r._mapping) for r in res]


@router.post("/installments", status_code=status.HTTP_201_CREATED)
async def create_installment(
    p: InstallmentIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    pid = uuid4()
    total_with_interest = p.total_amount * (Decimal("1") + p.interest_pct / Decimal("100"))
    monthly = (total_with_interest / Decimal(p.months)).quantize(Decimal("0.01"))
    await db.execute(
        text("INSERT INTO installment_plans (id, organization_id, sale_id, customer_id, total_amount, "
             "currency_id, months, interest_pct, start_date, notes, created_by) "
             "VALUES (:id, :o, :sid, :cid, :amt, :cur, :m, :ipct, :sd, :n, :u)"),
        {"id": str(pid), "o": org_id, "sid": str(p.sale_id), "cid": str(p.customer_id),
         "amt": total_with_interest, "cur": p.currency_id, "m": p.months, "ipct": p.interest_pct,
         "sd": p.start_date, "n": p.notes, "u": user_id},
    )
    for i in range(p.months):
        due = p.start_date + timedelta(days=30 * (i + 1))
        await db.execute(
            text("INSERT INTO installment_schedules (plan_id, due_date, amount) VALUES (:p, :d, :a)"),
            {"p": str(pid), "d": due, "a": monthly},
        )
    await db.commit()
    return {"id": str(pid), "monthly_amount": float(monthly)}


@router.get("/installments/{pid}")
async def installment_detail(
    pid: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT * FROM installment_plans WHERE id = :i AND organization_id = :o"),
        {"i": str(pid), "o": org_id},
    )
    plan = res.first()
    if not plan:
        raise HTTPException(404)
    plan_data = dict(plan._mapping)
    sched = await db.execute(
        text("SELECT * FROM installment_schedules WHERE plan_id = :p ORDER BY due_date"),
        {"p": str(pid)},
    )
    plan_data["schedules"] = [dict(r._mapping) for r in sched]
    return plan_data


class PayInstallmentIn(BaseModel):
    schedule_id: int
    amount: Decimal


@router.post("/installments/{pid}/pay")
async def pay_installment(
    pid: UUID, payload: PayInstallmentIn,
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        text("UPDATE installment_schedules SET paid_amount = paid_amount + :a, "
             "paid_at = NOW(), "
             "status = CASE WHEN paid_amount + :a >= amount THEN 'paid' ELSE 'partial' END "
             "WHERE id = :sid"),
        {"a": payload.amount, "sid": payload.schedule_id},
    )
    await db.execute(
        text("UPDATE installment_plans SET paid_amount = paid_amount + :a, "
             "status = CASE WHEN paid_amount + :a >= total_amount THEN 'completed' ELSE status END "
             "WHERE id = :pid"),
        {"a": payload.amount, "pid": str(pid)},
    )
    await db.commit()
    return {"ok": True}


# =========================================================
# CASHBOX SESSIONS (SMENA)
# =========================================================

class SessionOpenIn(BaseModel):
    cashbox_id: int
    device_id: int | None = None
    opened_balance: Decimal = Decimal("0")
    opened_diff: Decimal = Decimal("0")
    opened_note: str | None = None


class SessionCloseIn(BaseModel):
    closed_balance: Decimal
    closed_diff: Decimal = Decimal("0")
    closed_note: str | None = None


@router.get("/cashbox-sessions/active")
async def active_session(
    cashbox_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT cs.*, c.name AS cashbox_name FROM cashbox_sessions cs "
             "JOIN cashboxes c ON c.id = cs.cashbox_id "
             "WHERE cs.cashbox_id = :c AND cs.organization_id = :o AND cs.status = 'open' "
             "ORDER BY cs.opened_at DESC LIMIT 1"),
        {"c": cashbox_id, "o": org_id},
    )
    row = res.first()
    return dict(row._mapping) if row else None


@router.post("/cashbox-sessions/open", status_code=status.HTTP_201_CREATED)
async def open_session(
    s: SessionOpenIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    chk = await db.execute(
        text("SELECT id FROM cashbox_sessions WHERE cashbox_id = :c AND status = 'open'"),
        {"c": s.cashbox_id},
    )
    if chk.scalar():
        raise HTTPException(400, "Kassa allaqachon ochiq")
    sid = uuid4()
    await db.execute(
        text("INSERT INTO cashbox_sessions (id, organization_id, cashbox_id, device_id, opened_by, "
             "opened_balance, opened_diff, opened_note) "
             "VALUES (:id, :o, :c, :d, :u, :ob, :od, :on)"),
        {"id": str(sid), "o": org_id, "c": s.cashbox_id, "d": s.device_id, "u": user_id,
         "ob": s.opened_balance, "od": s.opened_diff, "on": s.opened_note},
    )
    await db.commit()
    return {"id": str(sid)}


@router.post("/cashbox-sessions/{sid}/close")
async def close_session(
    sid: UUID, payload: SessionCloseIn,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    totals = await db.execute(
        text("SELECT COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END), 0) AS inc, "
             "COALESCE(SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END), 0) AS exp, "
             "COALESCE((SELECT COUNT(*) FROM sales WHERE cashbox_session_id = :sid), 0) AS sc "
             "FROM cash_movements WHERE cashbox_session_id = :sid"),
        {"sid": str(sid)},
    )
    row = totals.first()
    inc, exp, sc = row.inc, row.exp, row.sc
    res = await db.execute(
        text("UPDATE cashbox_sessions SET closed_by = :u, closed_at = NOW(), "
             "closed_balance = :cb, closed_diff = :cd, closed_note = :cn, "
             "total_income = :inc, total_expense = :exp, sale_count = :sc, status = 'closed' "
             "WHERE id = :sid AND status = 'open' RETURNING id"),
        {"u": user_id, "cb": payload.closed_balance, "cd": payload.closed_diff,
         "cn": payload.closed_note, "inc": inc, "exp": exp, "sc": sc, "sid": str(sid)},
    )
    if not res.scalar():
        raise HTTPException(400, "Sessiya yopilgan yoki topilmadi")
    await db.commit()
    return {"ok": True, "total_income": float(inc), "total_expense": float(exp), "sale_count": sc}


@router.get("/cashbox-sessions")
async def list_sessions(
    cashbox_id: int | None = Query(None),
    status_f: str | None = Query(None, alias="status"),
    limit: int = 30, offset: int = 0,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    where = "WHERE cs.organization_id = :o"
    params: dict = {"o": org_id, "lim": limit, "off": offset}
    if cashbox_id:
        where += " AND cs.cashbox_id = :c"
        params["c"] = cashbox_id
    if status_f:
        where += " AND cs.status = :s"
        params["s"] = status_f
    res = await db.execute(
        text(f"SELECT cs.*, c.name AS cashbox_name, u1.full_name AS opened_by_name, "
             f"u2.full_name AS closed_by_name "
             f"FROM cashbox_sessions cs "
             f"JOIN cashboxes c ON c.id = cs.cashbox_id "
             f"LEFT JOIN users u1 ON u1.id = cs.opened_by "
             f"LEFT JOIN users u2 ON u2.id = cs.closed_by "
             f"{where} ORDER BY cs.opened_at DESC LIMIT :lim OFFSET :off"),
        params,
    )
    return [dict(r._mapping) for r in res]


# =========================================================
# OPEN TICKETS (cafe / restaurant tables)
# =========================================================

class TicketIn(BaseModel):
    ticket_name: str
    table_number: str | None = None
    guest_count: int | None = None
    cashbox_id: int | None = None
    warehouse_id: int | None = None
    customer_id: UUID | None = None
    notes: str | None = None


class TicketItemIn(BaseModel):
    product_id: UUID
    quantity: Decimal
    price: Decimal
    discount: Decimal = Decimal("0")
    notes: str | None = None


@router.get("/open-tickets")
async def list_open_tickets(
    status_f: str = Query("open", alias="status"),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT ot.*, c.name AS customer_name, w.name AS warehouse_name, "
             "(SELECT COUNT(*) FROM open_ticket_items WHERE ticket_id = ot.id) AS item_count "
             "FROM open_tickets ot "
             "LEFT JOIN customers c ON c.id = ot.customer_id "
             "LEFT JOIN warehouses w ON w.id = ot.warehouse_id "
             "WHERE ot.organization_id = :o AND ot.status = :s "
             "ORDER BY ot.opened_at DESC"),
        {"o": org_id, "s": status_f},
    )
    return [dict(r._mapping) for r in res]


@router.post("/open-tickets", status_code=status.HTTP_201_CREATED)
async def create_ticket(
    t: TicketIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    tid = uuid4()
    emp_res = await db.execute(
        text("SELECT id FROM employees WHERE user_id = :u AND organization_id = :o LIMIT 1"),
        {"u": user_id, "o": org_id},
    )
    emp_id = emp_res.scalar()
    await db.execute(
        text("INSERT INTO open_tickets (id, organization_id, ticket_name, table_number, guest_count, "
             "cashbox_id, warehouse_id, customer_id, responsible_id, notes) "
             "VALUES (:id, :o, :n, :tn, :gc, :cb, :wh, :ci, :ri, :nt)"),
        {"id": str(tid), "o": org_id, "n": t.ticket_name, "tn": t.table_number, "gc": t.guest_count,
         "cb": t.cashbox_id, "wh": t.warehouse_id,
         "ci": str(t.customer_id) if t.customer_id else None,
         "ri": str(emp_id) if emp_id else None, "nt": t.notes},
    )
    await db.commit()
    return {"id": str(tid)}


@router.get("/open-tickets/{tid}")
async def ticket_detail(
    tid: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT * FROM open_tickets WHERE id = :i AND organization_id = :o"),
        {"i": str(tid), "o": org_id},
    )
    t = res.first()
    if not t:
        raise HTTPException(404)
    data = dict(t._mapping)
    items = await db.execute(
        text("SELECT oti.*, p.name AS product_name, p.sku FROM open_ticket_items oti "
             "JOIN products p ON p.id = oti.product_id "
             "WHERE oti.ticket_id = :i ORDER BY oti.added_at"),
        {"i": str(tid)},
    )
    data["items"] = [dict(r._mapping) for r in items]
    return data


@router.post("/open-tickets/{tid}/items")
async def add_ticket_item(
    tid: UUID, item: TicketItemIn,
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        text("INSERT INTO open_ticket_items (ticket_id, product_id, quantity, price, discount, notes) "
             "VALUES (:t, :p, :q, :pr, :d, :n)"),
        {"t": str(tid), "p": str(item.product_id), "q": item.quantity,
         "pr": item.price, "d": item.discount, "n": item.notes},
    )
    await db.execute(
        text("UPDATE open_tickets SET total_amount = "
             "(SELECT COALESCE(SUM(quantity * price - discount), 0) FROM open_ticket_items WHERE ticket_id = :t) "
             "WHERE id = :t"),
        {"t": str(tid)},
    )
    await db.commit()
    return {"ok": True}


@router.delete("/open-tickets/{tid}/items/{iid}")
async def remove_ticket_item(
    tid: UUID, iid: int,
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        text("DELETE FROM open_ticket_items WHERE id = :i AND ticket_id = :t"),
        {"i": iid, "t": str(tid)},
    )
    await db.execute(
        text("UPDATE open_tickets SET total_amount = "
             "(SELECT COALESCE(SUM(quantity * price - discount), 0) FROM open_ticket_items WHERE ticket_id = :t) "
             "WHERE id = :t"),
        {"t": str(tid)},
    )
    await db.commit()
    return {"ok": True}


@router.post("/open-tickets/{tid}/close")
async def close_ticket(
    tid: UUID,
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        text("UPDATE open_tickets SET status = 'closed', closed_at = NOW() WHERE id = :t"),
        {"t": str(tid)},
    )
    await db.commit()
    return {"ok": True}


# =========================================================
# DISTRIBUTION / VISITS
# =========================================================

class RouteIn(BaseModel):
    name: str
    employee_id: UUID | None = None
    active_days: list[str] = []
    notes: str | None = None


@router.get("/distribution/routes")
async def list_routes(
    employee_id: UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    where = "WHERE r.organization_id = :o AND r.is_active"
    params: dict = {"o": org_id}
    if employee_id:
        where += " AND r.employee_id = :e"
        params["e"] = str(employee_id)
    res = await db.execute(
        text(f"SELECT r.*, e.full_name AS employee_name FROM distribution_routes r "
             f"LEFT JOIN employees e ON e.id = r.employee_id {where} ORDER BY r.name"),
        params,
    )
    return [dict(r._mapping) for r in res]


@router.post("/distribution/routes", status_code=status.HTTP_201_CREATED)
async def create_route(
    r: RouteIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    rid = uuid4()
    await db.execute(
        text("INSERT INTO distribution_routes (id, organization_id, name, employee_id, active_days, notes) "
             "VALUES (:id, :o, :n, :e, :d::jsonb, :nt)"),
        {"id": str(rid), "o": org_id, "n": r.name,
         "e": str(r.employee_id) if r.employee_id else None,
         "d": __import__("json").dumps(r.active_days), "nt": r.notes},
    )
    await db.commit()
    return {"id": str(rid)}


class PlannedVisitIn(BaseModel):
    route_id: UUID | None = None
    customer_id: UUID
    employee_id: UUID
    visit_date: date
    sort_order: int = 0


@router.get("/distribution/planned-visits")
async def list_planned_visits(
    visit_date: date | None = Query(None),
    employee_id: UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    where = "WHERE pv.organization_id = :o"
    params: dict = {"o": org_id}
    if visit_date:
        where += " AND pv.visit_date = :d"
        params["d"] = visit_date
    if employee_id:
        where += " AND pv.employee_id = :e"
        params["e"] = str(employee_id)
    res = await db.execute(
        text(f"SELECT pv.*, c.name AS customer_name, c.phone AS customer_phone, "
             f"e.full_name AS employee_name "
             f"FROM planned_visits pv "
             f"LEFT JOIN customers c ON c.id = pv.customer_id "
             f"LEFT JOIN employees e ON e.id = pv.employee_id "
             f"{where} ORDER BY pv.visit_date, pv.sort_order"),
        params,
    )
    return [dict(r._mapping) for r in res]


@router.post("/distribution/planned-visits", status_code=status.HTTP_201_CREATED)
async def create_planned_visit(
    v: PlannedVisitIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    vid = uuid4()
    await db.execute(
        text("INSERT INTO planned_visits (id, organization_id, route_id, customer_id, employee_id, visit_date, sort_order) "
             "VALUES (:id, :o, :r, :c, :e, :d, :s)"),
        {"id": str(vid), "o": org_id, "r": str(v.route_id) if v.route_id else None,
         "c": str(v.customer_id), "e": str(v.employee_id), "d": v.visit_date, "s": v.sort_order},
    )
    await db.commit()
    return {"id": str(vid)}


class VisitCheckInIn(BaseModel):
    customer_id: UUID
    planned_visit_id: UUID | None = None
    lat: float | None = None
    lng: float | None = None


@router.post("/visits/check-in", status_code=status.HTTP_201_CREATED)
async def visit_check_in(
    v: VisitCheckInIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    emp_res = await db.execute(
        text("SELECT id FROM employees WHERE user_id = :u AND organization_id = :o LIMIT 1"),
        {"u": user_id, "o": org_id},
    )
    emp_id = emp_res.scalar()
    if not emp_id:
        raise HTTPException(400, "Xodim profili topilmadi")
    vid = uuid4()
    await db.execute(
        text("INSERT INTO visits (id, organization_id, planned_visit_id, customer_id, employee_id, "
             "check_in_lat, check_in_lng) "
             "VALUES (:id, :o, :pv, :c, :e, :lat, :lng)"),
        {"id": str(vid), "o": org_id,
         "pv": str(v.planned_visit_id) if v.planned_visit_id else None,
         "c": str(v.customer_id), "e": str(emp_id), "lat": v.lat, "lng": v.lng},
    )
    if v.planned_visit_id:
        await db.execute(
            text("UPDATE planned_visits SET status = 'in_progress' WHERE id = :i"),
            {"i": str(v.planned_visit_id)},
        )
    await db.commit()
    return {"id": str(vid)}


class VisitCheckOutIn(BaseModel):
    comment: str | None = None
    lat: float | None = None
    lng: float | None = None
    sale_id: UUID | None = None


@router.post("/visits/{vid}/check-out")
async def visit_check_out(
    vid: UUID, payload: VisitCheckOutIn,
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        text("UPDATE visits SET check_out_at = NOW(), check_out_lat = :lat, check_out_lng = :lng, "
             "comment = :c, sale_id = :s, status = 'completed' WHERE id = :i"),
        {"lat": payload.lat, "lng": payload.lng, "c": payload.comment,
         "s": str(payload.sale_id) if payload.sale_id else None, "i": str(vid)},
    )
    await db.execute(
        text("UPDATE planned_visits SET status = 'completed' "
             "WHERE id = (SELECT planned_visit_id FROM visits WHERE id = :i)"),
        {"i": str(vid)},
    )
    await db.commit()
    return {"ok": True}


@router.get("/visits")
async def list_visits(
    employee_id: UUID | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    limit: int = 50, offset: int = 0,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    where = "WHERE v.organization_id = :o"
    params: dict = {"o": org_id, "lim": limit, "off": offset}
    if employee_id:
        where += " AND v.employee_id = :e"
        params["e"] = str(employee_id)
    if date_from:
        where += " AND v.check_in_at >= :df"
        params["df"] = date_from
    if date_to:
        where += " AND v.check_in_at < (CAST(:dt AS date) + INTERVAL '1 day')"
        params["dt"] = date_to
    res = await db.execute(
        text(f"SELECT v.*, c.name AS customer_name, e.full_name AS employee_name, "
             f"(SELECT COUNT(*) FROM visit_photos WHERE visit_id = v.id) AS photo_count "
             f"FROM visits v "
             f"LEFT JOIN customers c ON c.id = v.customer_id "
             f"LEFT JOIN employees e ON e.id = v.employee_id "
             f"{where} ORDER BY v.check_in_at DESC LIMIT :lim OFFSET :off"),
        params,
    )
    return [dict(r._mapping) for r in res]


class VisitPhotoIn(BaseModel):
    photo_url: str
    photo_type: str = "general"
    notes: str | None = None


@router.post("/visits/{vid}/photos")
async def add_visit_photo(
    vid: UUID, p: VisitPhotoIn,
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        text("INSERT INTO visit_photos (visit_id, photo_url, photo_type, notes) "
             "VALUES (:v, :u, :t, :n)"),
        {"v": str(vid), "u": p.photo_url, "t": p.photo_type, "n": p.notes},
    )
    await db.commit()
    return {"ok": True}


# =========================================================
# COURIER / DELIVERY
# =========================================================

class CourierStatusIn(BaseModel):
    is_online: bool
    lat: float | None = None
    lng: float | None = None


@router.post("/courier/status")
async def set_courier_status(
    s: CourierStatusIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    emp_res = await db.execute(
        text("SELECT id FROM employees WHERE user_id = :u AND organization_id = :o LIMIT 1"),
        {"u": user_id, "o": org_id},
    )
    emp_id = emp_res.scalar()
    if not emp_id:
        raise HTTPException(400, "Xodim profili topilmadi")
    await db.execute(
        text("INSERT INTO courier_status (organization_id, employee_id, is_online, last_seen_at, last_lat, last_lng) "
             "VALUES (:o, :e, :on, NOW(), :lat, :lng) "
             "ON CONFLICT (employee_id) DO UPDATE SET "
             "is_online = EXCLUDED.is_online, last_seen_at = NOW(), "
             "last_lat = EXCLUDED.last_lat, last_lng = EXCLUDED.last_lng"),
        {"o": org_id, "e": str(emp_id), "on": s.is_online, "lat": s.lat, "lng": s.lng},
    )
    await db.commit()
    return {"ok": True}


class CourierLocationIn(BaseModel):
    lat: float
    lng: float
    accuracy_m: float | None = None
    speed_kmh: float | None = None


@router.post("/courier/location")
async def push_courier_location(
    loc: CourierLocationIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    emp_res = await db.execute(
        text("SELECT id FROM employees WHERE user_id = :u AND organization_id = :o LIMIT 1"),
        {"u": user_id, "o": org_id},
    )
    emp_id = emp_res.scalar()
    if not emp_id:
        raise HTTPException(400)
    await db.execute(
        text("INSERT INTO courier_locations (employee_id, lat, lng, accuracy_m, speed_kmh) "
             "VALUES (:e, :lat, :lng, :a, :s)"),
        {"e": str(emp_id), "lat": loc.lat, "lng": loc.lng, "a": loc.accuracy_m, "s": loc.speed_kmh},
    )
    await db.execute(
        text("UPDATE courier_status SET last_seen_at = NOW(), last_lat = :lat, last_lng = :lng "
             "WHERE employee_id = :e"),
        {"e": str(emp_id), "lat": loc.lat, "lng": loc.lng},
    )
    await db.commit()
    return {"ok": True}


@router.get("/courier/online")
async def list_online_couriers(
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT cs.*, e.full_name AS employee_name, e.phone AS employee_phone "
             "FROM courier_status cs "
             "JOIN employees e ON e.id = cs.employee_id "
             "WHERE cs.organization_id = :o AND cs.is_online "
             "ORDER BY cs.last_seen_at DESC"),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


@router.get("/courier/{emp_id}/track")
async def get_courier_track(
    emp_id: UUID,
    hours: int = Query(8, le=48),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        text("SELECT lat, lng, captured_at, accuracy_m, speed_kmh FROM courier_locations "
             "WHERE employee_id = :e AND captured_at > NOW() - INTERVAL ':h hours' "
             "ORDER BY captured_at"),
        {"e": str(emp_id), "h": hours},
    )
    return [dict(r._mapping) for r in res]


class DeliveryOrderIn(BaseModel):
    sale_id: UUID | None = None
    customer_id: UUID
    courier_id: UUID | None = None
    delivery_address: str
    delivery_lat: float | None = None
    delivery_lng: float | None = None
    scheduled_at: datetime | None = None
    notes: str | None = None


@router.get("/delivery-orders")
async def list_delivery_orders(
    status_f: str | None = Query(None, alias="status"),
    courier_id: UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    where = "WHERE do.organization_id = :o"
    params: dict = {"o": org_id}
    if status_f:
        where += " AND do.status = :s"
        params["s"] = status_f
    if courier_id:
        where += " AND do.courier_id = :c"
        params["c"] = str(courier_id)
    res = await db.execute(
        text(f"SELECT do.*, c.name AS customer_name, c.phone AS customer_phone, "
             f"e.full_name AS courier_name "
             f"FROM delivery_orders do "
             f"LEFT JOIN customers c ON c.id = do.customer_id "
             f"LEFT JOIN employees e ON e.id = do.courier_id "
             f"{where} ORDER BY do.created_at DESC LIMIT 100"),
        params,
    )
    return [dict(r._mapping) for r in res]


@router.post("/delivery-orders", status_code=status.HTTP_201_CREATED)
async def create_delivery_order(
    o: DeliveryOrderIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    did = uuid4()
    num_res = await db.execute(
        text("SELECT COALESCE(MAX(CAST(NULLIF(REGEXP_REPLACE(order_number, '[^0-9]', '', 'g'), '') AS INT)), 0) + 1 "
             "FROM delivery_orders WHERE organization_id = :o"),
        {"o": org_id},
    )
    num = f"DLV-{num_res.scalar() or 1:05d}"
    await db.execute(
        text("INSERT INTO delivery_orders (id, organization_id, order_number, sale_id, customer_id, "
             "courier_id, delivery_address, delivery_lat, delivery_lng, scheduled_at, notes, "
             "status) VALUES (:id, :o, :nm, :s, :c, :cr, :da, :dla, :dlg, :sa, :n, "
             "CASE WHEN :cr IS NOT NULL THEN 'assigned' ELSE 'new' END)"),
        {"id": str(did), "o": org_id, "nm": num,
         "s": str(o.sale_id) if o.sale_id else None,
         "c": str(o.customer_id),
         "cr": str(o.courier_id) if o.courier_id else None,
         "da": o.delivery_address, "dla": o.delivery_lat, "dlg": o.delivery_lng,
         "sa": o.scheduled_at, "n": o.notes},
    )
    await db.commit()
    return {"id": str(did), "order_number": num}


class DeliveryStatusIn(BaseModel):
    status: str
    courier_id: UUID | None = None


@router.post("/delivery-orders/{did}/status")
async def update_delivery_status(
    did: UUID, payload: DeliveryStatusIn,
    db: AsyncSession = Depends(get_db),
):
    delivered = ", delivered_at = NOW()" if payload.status == "delivered" else ""
    await db.execute(
        text(f"UPDATE delivery_orders SET status = :s, "
             f"courier_id = COALESCE(:cr, courier_id) {delivered} "
             f"WHERE id = :i"),
        {"s": payload.status, "cr": str(payload.courier_id) if payload.courier_id else None,
         "i": str(did)},
    )
    await db.commit()
    return {"ok": True}


# =========================================================
# PUSH TOKENS (FCM / Web Push)
# =========================================================

class PushTokenIn(BaseModel):
    token: str
    platform: str = "web"  # web|android|ios
    device_label: str | None = None


@router.post("/push/register")
async def register_push_token(
    p: PushTokenIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    await db.execute(
        text("INSERT INTO push_tokens (organization_id, user_id, token, platform, device_label) "
             "VALUES (:o, :u, :t, :p, :d) "
             "ON CONFLICT (user_id, token) DO UPDATE SET "
             "last_used_at = NOW(), platform = EXCLUDED.platform"),
        {"o": org_id, "u": user_id, "t": p.token, "p": p.platform, "d": p.device_label},
    )
    await db.commit()
    return {"ok": True}


@router.delete("/push/{token:path}")
async def unregister_push_token(
    token: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    await db.execute(
        text("DELETE FROM push_tokens WHERE user_id = :u AND token = :t"),
        {"u": user_id, "t": token},
    )
    await db.commit()
    return {"ok": True}


# =========================================================
# PASSCODE (per device quick-login)
# =========================================================

class PasscodeSetIn(BaseModel):
    passcode: str = Field(min_length=4, max_length=8)
    device_id: str
    biometric_enabled: bool = False


@router.post("/passcode/set")
async def set_passcode(
    p: PasscodeSetIn,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    h = pwd_ctx.hash(p.passcode)
    await db.execute(
        text("INSERT INTO user_passcodes (user_id, passcode_hash, device_id, biometric_enabled) "
             "VALUES (:u, :h, :d, :b) "
             "ON CONFLICT (user_id, device_id) DO UPDATE SET "
             "passcode_hash = EXCLUDED.passcode_hash, biometric_enabled = EXCLUDED.biometric_enabled"),
        {"u": user_id, "h": h, "d": p.device_id, "b": p.biometric_enabled},
    )
    await db.commit()
    return {"ok": True}


class PasscodeVerifyIn(BaseModel):
    user_id: UUID
    passcode: str
    device_id: str


@router.post("/passcode/verify")
@limiter.limit("10/minute")
async def verify_passcode(
    request: Request,
    p: PasscodeVerifyIn = Body(...),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        text("SELECT passcode_hash FROM user_passcodes WHERE user_id = :u AND device_id = :d"),
        {"u": str(p.user_id), "d": p.device_id},
    )
    h = res.scalar()
    if not h or not pwd_ctx.verify(p.passcode, h):
        raise HTTPException(401, "Noto'g'ri passcode")
    await db.execute(
        text("UPDATE user_passcodes SET last_used_at = NOW() WHERE user_id = :u AND device_id = :d"),
        {"u": str(p.user_id), "d": p.device_id},
    )
    await db.commit()
    # Return access token like normal login
    from app.core.security import create_access_token, create_refresh_token
    return {
        "access_token": create_access_token(str(p.user_id)),
        "refresh_token": create_refresh_token(str(p.user_id)),
        "token_type": "bearer",
    }


# =========================================================
# POS PAGES (predefined product groups for POS UI)
# =========================================================

class PosPageIn(BaseModel):
    name: str
    color: str = "#3393cb"
    sort_order: int = 0


@router.get("/pos-pages")
async def list_pos_pages(
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("SELECT pp.*, "
             "(SELECT COUNT(*) FROM pos_page_items WHERE page_id = pp.id) AS item_count "
             "FROM pos_pages pp WHERE pp.organization_id = :o ORDER BY pp.sort_order, pp.name"),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


@router.post("/pos-pages", status_code=status.HTTP_201_CREATED)
async def create_pos_page(
    p: PosPageIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("INSERT INTO pos_pages (organization_id, name, color, sort_order) "
             "VALUES (:o, :n, :c, :s) RETURNING id"),
        {"o": org_id, "n": p.name, "c": p.color, "s": p.sort_order},
    )
    await db.commit()
    return {"id": res.scalar()}


@router.get("/pos-pages/{pid}/items")
async def get_page_items(
    pid: int,
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        text("SELECT ppi.*, p.name, p.sku, p.sale_price, p.image_url FROM pos_page_items ppi "
             "JOIN products p ON p.id = ppi.product_id "
             "WHERE ppi.page_id = :p ORDER BY ppi.sort_order"),
        {"p": pid},
    )
    return [dict(r._mapping) for r in res]


class PosPageItemsIn(BaseModel):
    product_ids: list[UUID]


@router.post("/pos-pages/{pid}/items")
async def set_page_items(
    pid: int, payload: PosPageItemsIn,
    db: AsyncSession = Depends(get_db),
):
    await db.execute(text("DELETE FROM pos_page_items WHERE page_id = :p"), {"p": pid})
    for i, prod_id in enumerate(payload.product_ids):
        await db.execute(
            text("INSERT INTO pos_page_items (page_id, product_id, sort_order) VALUES (:p, :pr, :s)"),
            {"p": pid, "pr": str(prod_id), "s": i},
        )
    await db.commit()
    return {"ok": True}


# =========================================================
# CASHBACK
# =========================================================

class CashbackEarnIn(BaseModel):
    customer_id: UUID
    sale_id: UUID | None = None
    amount: Decimal
    notes: str | None = None


@router.post("/cashback/earn")
async def cashback_earn(
    p: CashbackEarnIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    new_balance = await db.execute(
        text("UPDATE customers SET cashback_balance = cashback_balance + :a "
             "WHERE id = :c AND organization_id = :o RETURNING cashback_balance"),
        {"a": p.amount, "c": str(p.customer_id), "o": org_id},
    )
    bal = new_balance.scalar()
    await db.execute(
        text("INSERT INTO cashback_transactions (organization_id, customer_id, sale_id, kind, amount, balance_after, notes) "
             "VALUES (:o, :c, :s, 'earn', :a, :b, :n)"),
        {"o": org_id, "c": str(p.customer_id),
         "s": str(p.sale_id) if p.sale_id else None,
         "a": p.amount, "b": bal, "n": p.notes},
    )
    await db.commit()
    return {"ok": True, "balance": float(bal or 0)}


@router.post("/cashback/spend")
async def cashback_spend(
    p: CashbackEarnIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    bal_res = await db.execute(
        text("SELECT cashback_balance FROM customers WHERE id = :c AND organization_id = :o"),
        {"c": str(p.customer_id), "o": org_id},
    )
    bal = bal_res.scalar() or Decimal("0")
    if bal < p.amount:
        raise HTTPException(400, "Cashback balansi yetarli emas")
    new_balance = await db.execute(
        text("UPDATE customers SET cashback_balance = cashback_balance - :a "
             "WHERE id = :c AND organization_id = :o RETURNING cashback_balance"),
        {"a": p.amount, "c": str(p.customer_id), "o": org_id},
    )
    nb = new_balance.scalar()
    await db.execute(
        text("INSERT INTO cashback_transactions (organization_id, customer_id, sale_id, kind, amount, balance_after, notes) "
             "VALUES (:o, :c, :s, 'spend', :a, :b, :n)"),
        {"o": org_id, "c": str(p.customer_id),
         "s": str(p.sale_id) if p.sale_id else None,
         "a": p.amount, "b": nb, "n": p.notes},
    )
    await db.commit()
    return {"ok": True, "balance": float(nb or 0)}


# =========================================================
# OCR (photo -> fields). Stub — returns empty fields if no provider key.
# =========================================================

class OCRRequest(BaseModel):
    image_base64: str
    target: str = "product"  # product|invoice|business_card


@router.post("/ocr/extract")
async def ocr_extract(
    p: OCRRequest,
):
    """
    Hozircha stub. Anthropic/OpenAI Vision API kaliti bo'lganda
    rasm asosida mahsulot/faktura ma'lumotini chiqaradi.
    """
    import os
    if not (os.getenv("ANTHROPIC_API_KEY") or os.getenv("OPENAI_API_KEY")):
        return {"ok": False, "error": "Vision API key sozlanmagan", "fields": {}}

    # Anthropic Claude Vision
    if os.getenv("ANTHROPIC_API_KEY"):
        try:
            import anthropic
            client = anthropic.Anthropic()
            prompt_map = {
                "product": "Rasmda ko'rinayotgan mahsulot to'g'risida JSON qaytaring: "
                          "{name, brand, barcode, weight, description}. Faqat JSON, boshqa hech narsa.",
                "invoice": "Fakturadan ma'lumotlarni chiqaring JSON shaklida: "
                          "{number, date, supplier, total, items: [{name, qty, price}]}. Faqat JSON.",
                "business_card": "Vizitkadan ma'lumot: {name, position, phone, email, company}. Faqat JSON.",
            }
            msg = client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=1024,
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg",
                                                      "data": p.image_base64}},
                        {"type": "text", "text": prompt_map.get(p.target, prompt_map["product"])},
                    ],
                }],
            )
            import json as _json
            text_content = msg.content[0].text
            try:
                fields = _json.loads(text_content)
            except Exception:
                # Try to extract JSON from response
                import re
                m = re.search(r'\{.*\}', text_content, re.DOTALL)
                fields = _json.loads(m.group(0)) if m else {}
            return {"ok": True, "fields": fields}
        except Exception as e:
            return {"ok": False, "error": str(e), "fields": {}}

    return {"ok": False, "error": "OCR provayder mavjud emas", "fields": {}}


# =========================================================
# FILE ATTACHMENTS
# =========================================================

@router.get("/attachments/{entity_type}/{entity_id}")
async def list_attachments(
    entity_type: str, entity_id: str,
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        text("SELECT * FROM file_attachments WHERE entity_type = :et AND entity_id = :ei "
             "ORDER BY created_at DESC"),
        {"et": entity_type, "ei": entity_id},
    )
    return [dict(r._mapping) for r in res]


class AttachmentIn(BaseModel):
    file_url: str
    file_name: str | None = None
    mime_type: str | None = None
    size_bytes: int | None = None


@router.post("/attachments/{entity_type}/{entity_id}", status_code=status.HTTP_201_CREATED)
async def add_attachment(
    entity_type: str, entity_id: str, a: AttachmentIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    res = await db.execute(
        text("INSERT INTO file_attachments (organization_id, entity_type, entity_id, file_url, "
             "file_name, mime_type, size_bytes, uploaded_by) "
             "VALUES (:o, :et, :ei, :u, :n, :m, :s, :ub) RETURNING id"),
        {"o": org_id, "et": entity_type, "ei": entity_id, "u": a.file_url,
         "n": a.file_name, "m": a.mime_type, "s": a.size_bytes, "ub": user_id},
    )
    await db.commit()
    return {"id": res.scalar()}


@router.delete("/attachments/{aid}")
async def delete_attachment(
    aid: int,
    db: AsyncSession = Depends(get_db),
):
    await db.execute(text("DELETE FROM file_attachments WHERE id = :i"), {"i": aid})
    await db.commit()
    return {"ok": True}
