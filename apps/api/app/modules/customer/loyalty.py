"""Loyalty points ledger — real earn/redeem/adjust balance (RG-6).

loyalty_ledger is the source of truth; customers.loyalty_balance is a
denormalized fast-read cache. Every balance mutation goes through
_apply_balance_delta() with `points` as a SIGNED delta (earn > 0,
redeem < 0, adjust either sign), so the two never drift and there is
no per-direction branching when applying the balance change.
"""
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def get_earn_pct(db: AsyncSession, org_id: str) -> Decimal:
    """app_settings[key='loyalty'].value['earn_pct'] — percentage of
    sales.total_amount credited as points when a sale is fully paid.
    0/disabled if unset, so this never silently activates for an org
    that hasn't configured it."""
    res = await db.execute(
        text("SELECT value FROM app_settings WHERE organization_id = :o AND key = 'loyalty'"),
        {"o": org_id},
    )
    row = res.first()
    if not row or not row.value:
        return Decimal("0")
    cfg = row.value if isinstance(row.value, dict) else {}
    pct = cfg.get("earn_pct")
    if pct is None:
        return Decimal("0")
    try:
        return Decimal(str(pct))
    except Exception:
        return Decimal("0")


async def _apply_balance_delta(
    db: AsyncSession, org_id: str, customer_id: str, delta: Decimal,
) -> Decimal:
    res = await db.execute(
        text(
            "UPDATE customers SET loyalty_balance = loyalty_balance + :d "
            "WHERE id = :c AND organization_id = :o RETURNING loyalty_balance"
        ),
        {"d": delta, "c": customer_id, "o": org_id},
    )
    bal = res.scalar()
    if bal is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mijoz topilmadi")
    return Decimal(str(bal))


async def _insert_ledger_row(
    db: AsyncSession,
    org_id: str,
    customer_id: str,
    sale_id: str | None,
    direction: str,
    points: Decimal,
    notes: str | None,
    created_by: str | None,
) -> None:
    await db.execute(
        text(
            "INSERT INTO loyalty_ledger "
            "(organization_id, customer_id, sale_id, direction, points, notes, created_by) "
            "VALUES (:o, :c, :s, :dir, :p, :n, :u)"
        ),
        {"o": org_id, "c": customer_id, "s": sale_id, "dir": direction,
         "p": points, "n": notes, "u": created_by},
    )


async def earn_on_pay(
    db: AsyncSession,
    org_id: str,
    customer_id: str | None,
    sale_id: str,
    sale_total: Decimal,
    user_id: str | None,
) -> Decimal:
    """Credit sale_total * earn_pct / 100 points on full payment.
    No-op (returns 0) if there's no customer on the sale or earn_pct
    is 0/unset. Called once, only on the paid-transition — callers are
    responsible for not calling this more than once per sale."""
    if not customer_id:
        return Decimal("0")
    earn_pct = await get_earn_pct(db, org_id)
    if earn_pct <= 0:
        return Decimal("0")
    points = (sale_total * earn_pct / Decimal("100")).quantize(Decimal("0.01"))
    if points <= 0:
        return Decimal("0")
    await _insert_ledger_row(db, org_id, customer_id, sale_id, "earn", points, None, user_id)
    await _apply_balance_delta(db, org_id, customer_id, points)
    return points


async def redeem_at_pay(
    db: AsyncSession,
    org_id: str,
    customer_id: str | None,
    sale_id: str,
    redeem_points: Decimal,
    user_id: str | None,
) -> Decimal:
    """Validate and apply a points redemption as a payment discount
    (1 point = 1 currency unit, matching how earn_on_pay credits points
    in currency units). Returns the discount amount applied (== redeem_points).
    Raises 422 if redeem_points exceeds the customer's current balance, or
    if no customer is attached to the sale."""
    if redeem_points <= 0:
        return Decimal("0")
    if not customer_id:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Ball sarflash uchun mijoz tanlanishi shart",
        )
    res = await db.execute(
        text(
            "SELECT loyalty_balance FROM customers "
            "WHERE id = :c AND organization_id = :o FOR UPDATE"
        ),
        {"c": customer_id, "o": org_id},
    )
    row = res.first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mijoz topilmadi")
    balance = Decimal(str(row.loyalty_balance or 0))
    if redeem_points > balance:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Ball balansi yetarli emas: mavjud {balance}, so'ralgan {redeem_points}",
        )
    await _insert_ledger_row(db, org_id, customer_id, sale_id, "redeem", -redeem_points, None, user_id)
    await _apply_balance_delta(db, org_id, customer_id, -redeem_points)
    return redeem_points


async def reverse_sale_earn(
    db: AsyncSession,
    org_id: str,
    sale_id: str,
    user_id: str | None,
) -> Decimal:
    """Cancellation hook — claws back exactly the points a sale earned (if
    any), via a signed 'adjust' ledger row. Returns the amount reversed
    (0 if the sale never earned points, e.g. it was cancelled before full
    payment). Deliberately does NOT touch 'redeem' rows — redeeming points
    is a separate concern the ticket does not ask to reverse on cancel."""
    res = await db.execute(
        text(
            "SELECT customer_id, points FROM loyalty_ledger "
            "WHERE organization_id = :o AND sale_id = :s AND direction = 'earn'"
        ),
        {"o": org_id, "s": sale_id},
    )
    rows = list(res)
    if not rows:
        return Decimal("0")
    customer_id = str(rows[0].customer_id)
    earned = sum((Decimal(str(r.points)) for r in rows), Decimal("0"))
    if earned <= 0:
        return Decimal("0")
    await _insert_ledger_row(
        db, org_id, customer_id, sale_id, "adjust", -earned,
        "Sotuv bekor qilindi — ball qaytarildi", user_id,
    )
    await _apply_balance_delta(db, org_id, customer_id, -earned)
    return earned
