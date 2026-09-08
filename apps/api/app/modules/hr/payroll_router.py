"""Monthly payroll runs — draft -> approved -> paid, posting to the
accounting ledger (Phase: audit gap #2, ish haqi hisoblash).

Accounting model (see docs/plan discussion):
  1. Advances during the month (/finance/movements, employee_id set) already
     post Dr payroll_payable / Cr cash — see finance/router.py _post_movement_entry.
  2. Approve: Dr payroll_expense (Sigma gross) / Cr tax_payable (Sigma deductions)
     / Cr payroll_payable per employee (gross - deductions) — advances already
     posted in step 1 net out naturally against this liability.
  3. Pay: Dr payroll_payable per employee (net_pay remaining) / Cr cash.
"""
import logging
from datetime import date
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_org_id, get_current_user_id
from app.modules.rbac.deps import require_permission
from app.modules.accounting.posting import (
    JournalLine, post_journal_entry, get_default_account_id, get_cashbox_account_id,
)

log = logging.getLogger(__name__)

router = APIRouter(prefix="/hr/payroll", tags=["hr", "payroll"])


def _period_bounds(period_month: date) -> tuple[date, date]:
    start = period_month.replace(day=1)
    end = date(start.year + (1 if start.month == 12 else 0), (start.month % 12) + 1, 1)
    return start, end


class CreateRunIn(BaseModel):
    period_month: date
    tax_rate: Decimal = Decimal("0")
    notes: str | None = None


@router.get("/runs")
async def list_runs(
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    res = await db.execute(
        text("""
            SELECT r.id, r.period_month, r.status, r.tax_rate, r.notes, r.created_at, r.approved_at, r.paid_at,
                   COUNT(i.id) AS employee_count,
                   COALESCE(SUM(i.net_pay), 0) AS total_net
            FROM payroll_runs r
            LEFT JOIN payroll_items i ON i.run_id = r.id
            WHERE r.organization_id = :o
            GROUP BY r.id
            ORDER BY r.period_month DESC
        """),
        {"o": org_id},
    )
    return [dict(r._mapping) for r in res]


@router.post("/runs", status_code=status.HTTP_201_CREATED)
async def create_run(
    p: CreateRunIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    start, end = _period_bounds(p.period_month)

    exists = await db.execute(
        text("SELECT 1 FROM payroll_runs WHERE organization_id = :o AND period_month = :pm"),
        {"o": org_id, "pm": start},
    )
    if exists.scalar():
        raise HTTPException(status.HTTP_409_CONFLICT, "Bu davr uchun hisob-kitob allaqachon mavjud")

    run_res = await db.execute(
        text("""
            INSERT INTO payroll_runs (organization_id, period_month, tax_rate, notes, created_by)
            VALUES (:o, :pm, :tr, :n, :u) RETURNING id
        """),
        {"o": org_id, "pm": start, "tr": p.tax_rate, "n": p.notes, "u": user_id},
    )
    run_id = run_res.scalar()

    employees = await db.execute(
        text("SELECT id, COALESCE(salary, 0) AS salary FROM employees WHERE organization_id = :o AND is_active = TRUE"),
        {"o": org_id},
    )
    for emp in employees:
        base = Decimal(str(emp.salary or 0))
        deductions = (base * p.tax_rate / 100).quantize(Decimal("0.01"))

        adv_res = await db.execute(
            text("""
                SELECT COALESCE(SUM(amount), 0) AS a FROM cash_movements
                WHERE organization_id = :o AND employee_id = :e AND direction = 'out'
                  AND movement_date >= :s AND movement_date < :e2
            """),
            {"o": org_id, "e": str(emp.id), "s": start, "e2": end},
        )
        advance = Decimal(str(adv_res.scalar() or 0))
        net_pay = base - deductions - advance

        await db.execute(
            text("""
                INSERT INTO payroll_items (run_id, employee_id, base_salary, deductions, advance_deducted, net_pay)
                VALUES (:r, :e, :b, :d, :a, :n)
            """),
            {"r": run_id, "e": str(emp.id), "b": base, "d": deductions, "a": advance, "n": net_pay},
        )

    await db.commit()
    return {"id": str(run_id)}


@router.get("/runs/{run_id}")
async def get_run(
    run_id: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    head = await db.execute(
        text("SELECT * FROM payroll_runs WHERE id = :id AND organization_id = :o"),
        {"id": str(run_id), "o": org_id},
    )
    h = head.first()
    if not h:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Hisob-kitob topilmadi")

    items = await db.execute(
        text("""
            SELECT i.id, i.employee_id, e.full_name AS employee_name,
                   i.base_salary, i.bonus, i.deductions, i.advance_deducted, i.net_pay, i.notes
            FROM payroll_items i
            JOIN employees e ON e.id = i.employee_id
            WHERE i.run_id = :id
            ORDER BY e.full_name
        """),
        {"id": str(run_id)},
    )
    return {"head": dict(h._mapping), "items": [dict(r._mapping) for r in items]}


class UpdateItemIn(BaseModel):
    bonus: Decimal = Decimal("0")
    deductions: Decimal = Decimal("0")
    notes: str | None = None


@router.put("/runs/{run_id}/items/{item_id}")
async def update_item(
    run_id: UUID, item_id: int, p: UpdateItemIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    run = await db.execute(
        text("SELECT status FROM payroll_runs WHERE id = :id AND organization_id = :o"),
        {"id": str(run_id), "o": org_id},
    )
    r = run.first()
    if not r:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Hisob-kitob topilmadi")
    if r.status != "draft":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Faqat qoralama holatidagi hisob-kitobni tahrirlash mumkin")

    item = await db.execute(
        text("SELECT base_salary, advance_deducted FROM payroll_items WHERE id = :id AND run_id = :r"),
        {"id": item_id, "r": str(run_id)},
    )
    it = item.first()
    if not it:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Qator topilmadi")

    net_pay = Decimal(str(it.base_salary)) + p.bonus - p.deductions - Decimal(str(it.advance_deducted))
    await db.execute(
        text("""
            UPDATE payroll_items SET bonus = :b, deductions = :d, notes = :n, net_pay = :np
            WHERE id = :id
        """),
        {"b": p.bonus, "d": p.deductions, "n": p.notes, "np": net_pay, "id": item_id},
    )
    await db.commit()
    return {"ok": True, "net_pay": float(net_pay)}


@router.delete("/runs/{run_id}")
async def delete_run(
    run_id: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
):
    run = await db.execute(
        text("SELECT status FROM payroll_runs WHERE id = :id AND organization_id = :o"),
        {"id": str(run_id), "o": org_id},
    )
    r = run.first()
    if not r:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Hisob-kitob topilmadi")
    if r.status != "draft":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Faqat qoralama holatidagi hisob-kitobni bekor qilish mumkin")
    await db.execute(text("DELETE FROM payroll_runs WHERE id = :id"), {"id": str(run_id)})
    await db.commit()
    return {"ok": True}


@router.post("/runs/{run_id}/approve", dependencies=[Depends(require_permission("hr.payroll.approve"))])
async def approve_run(
    run_id: UUID,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    run = await db.execute(
        text("SELECT status FROM payroll_runs WHERE id = :id AND organization_id = :o"),
        {"id": str(run_id), "o": org_id},
    )
    r = run.first()
    if not r:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Hisob-kitob topilmadi")
    if r.status != "draft":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bu hisob-kitob allaqachon tasdiqlangan")

    items = await db.execute(
        text("SELECT employee_id, base_salary, bonus, deductions FROM payroll_items WHERE run_id = :id"),
        {"id": str(run_id)},
    )
    rows = list(items)
    if not rows:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Hisob-kitobda xodimlar yo'q")

    total_gross = sum(Decimal(str(x.base_salary)) + Decimal(str(x.bonus)) for x in rows)
    total_deductions = sum(Decimal(str(x.deductions)) for x in rows)

    expense_id = await get_default_account_id(db, org_id, "payroll_expense")
    payable_id = await get_default_account_id(db, org_id, "payroll_payable")
    tax_id = await get_default_account_id(db, org_id, "tax_payable")

    lines = [JournalLine(expense_id, debit=float(total_gross))]
    if total_deductions > 0:
        lines.append(JournalLine(tax_id, credit=float(total_deductions)))
    for x in rows:
        gross = Decimal(str(x.base_salary)) + Decimal(str(x.bonus))
        net_of_tax = gross - Decimal(str(x.deductions))
        if net_of_tax != 0:
            lines.append(JournalLine(
                payable_id, credit=float(net_of_tax),
                counterparty_type="employee", counterparty_id=str(x.employee_id),
            ))

    await post_journal_entry(
        db, org_id, lines, source_type="payroll_run", source_id=str(run_id),
        description=f"Ish haqi hisob-kitobi #{run_id}", user_id=user_id,
    )

    await db.execute(
        text("UPDATE payroll_runs SET status = 'approved', approved_at = NOW() WHERE id = :id"),
        {"id": str(run_id)},
    )
    await db.commit()
    return {"ok": True, "status": "approved"}


class PayRunIn(BaseModel):
    cashbox_id: int


@router.post("/runs/{run_id}/pay", dependencies=[Depends(require_permission("hr.payroll.pay"))])
async def pay_run(
    run_id: UUID, p: PayRunIn,
    db: AsyncSession = Depends(get_db),
    org_id: str = Depends(get_current_org_id),
    user_id: str = Depends(get_current_user_id),
):
    run = await db.execute(
        text("SELECT status FROM payroll_runs WHERE id = :id AND organization_id = :o"),
        {"id": str(run_id), "o": org_id},
    )
    r = run.first()
    if not r:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Hisob-kitob topilmadi")
    if r.status != "approved":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Faqat tasdiqlangan hisob-kitobni to'lash mumkin")

    cb_check = await db.execute(
        text("SELECT 1 FROM cashboxes WHERE id = :cb AND organization_id = :o"),
        {"cb": p.cashbox_id, "o": org_id},
    )
    if not cb_check.first():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "cashbox_id notog'ri")

    items = await db.execute(
        text("SELECT employee_id, net_pay FROM payroll_items WHERE run_id = :id AND net_pay > 0"),
        {"id": str(run_id)},
    )
    rows = list(items)
    total_pay = sum(Decimal(str(x.net_pay)) for x in rows)

    payable_id = await get_default_account_id(db, org_id, "payroll_payable")
    cash_id = await get_cashbox_account_id(db, org_id, p.cashbox_id)

    lines = [
        JournalLine(payable_id, debit=float(x.net_pay),
                    counterparty_type="employee", counterparty_id=str(x.employee_id))
        for x in rows
    ] + [JournalLine(cash_id, credit=float(total_pay))]

    await post_journal_entry(
        db, org_id, lines, source_type="payroll_payment", source_id=str(run_id),
        description=f"Ish haqi to'lovi #{run_id}", user_id=user_id,
    )

    for x in rows:
        await db.execute(
            text("""
                INSERT INTO cash_movements (organization_id, cashbox_id, direction, amount, employee_id, description, created_by)
                VALUES (:o, :cb, 'out', :amt, :e, :d, :u)
            """),
            {"o": org_id, "cb": p.cashbox_id, "amt": x.net_pay, "e": str(x.employee_id),
             "d": f"Ish haqi to'lovi #{run_id}", "u": user_id},
        )
    if rows:
        await db.execute(
            text("UPDATE cashboxes SET balance = balance - :a WHERE id = :cb"),
            {"a": total_pay, "cb": p.cashbox_id},
        )

    await db.execute(
        text("UPDATE payroll_runs SET status = 'paid', paid_at = NOW() WHERE id = :id"),
        {"id": str(run_id)},
    )
    await db.commit()
    return {"ok": True, "status": "paid", "total_paid": float(total_pay)}
