"""Core sale-creation logic shared by /sale/sales (staff), the B2B customer
portal (EC-3) and, later, the B2C storefront (EC-6).

Does not call log_action() or notifications — callers do that themselves
after create_sale_core() returns. Commits exactly once, inside this function.
Price is never computed here — every caller resolves price beforehand
(staff types it, B2B uses customer/pricing.py, B2C uses products.sale_price).
"""
import json
import logging
from dataclasses import dataclass
from decimal import Decimal
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.accounting.posting import (
    JournalLine,
    get_cashbox_account_id,
    get_default_account_id,
    post_journal_entry,
)
from app.modules.customer import loyalty as loyalty_service
from app.modules.warehouse.service import _stock_apply, explode_bom

log = logging.getLogger(__name__)


@dataclass
class SaleLineInput:
    product_id: str
    quantity: Decimal
    price: Decimal
    discount: Decimal = Decimal("0")


@dataclass
class PaymentLineInput:
    amount: Decimal
    payment_type_id: int | None = None
    cashbox_id: int | None = None


@dataclass
class SaleCreateResult:
    sale_id: str
    total_amount: Decimal
    total_cost: Decimal
    paid_amount: Decimal = Decimal("0")
    loyalty_earned: Decimal = Decimal("0")


async def verify_warehouse_in_org(db: AsyncSession, warehouse_id: int, org_id: str) -> None:
    """HI-1: ensure warehouse belongs to caller org."""
    res = await db.execute(
        text("SELECT 1 FROM warehouses WHERE id = :w AND organization_id = :o"),
        {"w": warehouse_id, "o": org_id},
    )
    if not res.first():
        raise HTTPException(422, "warehouse_id does not belong to your organization")


async def verify_products_in_org(db: AsyncSession, product_ids: list[str], org_id: str) -> None:
    """HI-1: ensure ALL product_ids belong to caller org and are not archived (one query)."""
    if not product_ids:
        return
    res = await db.execute(
        text("SELECT id, is_archived FROM products WHERE id = ANY(CAST(:ids AS uuid[])) AND organization_id = :o"),
        {"ids": [str(x) for x in product_ids], "o": org_id},
    )
    rows = list(res)
    found = {str(r.id) for r in rows}
    missing = [str(pid) for pid in product_ids if str(pid) not in found]
    if missing:
        raise HTTPException(422, f"product_id does not belong to your organization: {missing[0]}")
    archived = [str(r.id) for r in rows if r.is_archived]
    if archived:
        raise HTTPException(422, "Mahsulot arxivda: yangi operatsiyaga qo'shib bo'lmaydi")


async def verify_cashbox_in_org(db: AsyncSession, cashbox_id: int | None, org_id: str) -> None:
    """RG-2: ensure a payment line's cashbox belongs to caller org (or is None)."""
    if cashbox_id is None:
        return
    res = await db.execute(
        text("SELECT 1 FROM cashboxes WHERE id = :cb AND organization_id = :o"),
        {"cb": cashbox_id, "o": org_id},
    )
    if not res.first():
        raise HTTPException(422, "cashbox_id does not belong to your organization")


async def verify_payment_type_in_org(db: AsyncSession, payment_type_id: int | None, org_id: str) -> None:
    """RG-2: ensure a payment line's payment_type_id belongs to caller org (or is None)."""
    if payment_type_id is None:
        return
    res = await db.execute(
        text("SELECT 1 FROM payment_types WHERE id = :pt AND organization_id = :o"),
        {"pt": payment_type_id, "o": org_id},
    )
    if not res.first():
        raise HTTPException(422, "payment_type_id does not belong to your organization")


async def get_online_warehouse_id(db: AsyncSession, org_id: str) -> int | None:
    """app_settings[key='ecommerce'].value['online_warehouse_id'] — B2B portal va
    B2C storefront ikkisi ham shu bitta sozlamadan foydalanadi."""
    res = await db.execute(
        text("SELECT value FROM app_settings WHERE organization_id = :o AND key = 'ecommerce'"),
        {"o": org_id},
    )
    row = res.first()
    if not row or not row.value:
        return None
    cfg = row.value if isinstance(row.value, dict) else json.loads(row.value)
    wid = cfg.get("online_warehouse_id")
    return int(wid) if wid is not None else None


async def create_sale_core(
    db: AsyncSession,
    *,
    org_id: str,
    customer_id: str | None,
    warehouse_id: int,
    currency_id: int | None,
    rate: Decimal,
    items: list[SaleLineInput],
    notes: str | None,
    user_id: str | None,
    source_type: str = "sale",
    payments: list[PaymentLineInput] | None = None,
) -> SaleCreateResult:
    await verify_warehouse_in_org(db, warehouse_id, org_id)
    await verify_products_in_org(db, [it.product_id for it in items], org_id)

    if not items:
        raise HTTPException(422, "items bo'sh bo'lishi mumkin emas")

    # Deadlock avoidance: lock stock_balances rows in a stable order so two
    # concurrent multi-line checkouts can't wait on each other in reverse order.
    items = sorted(items, key=lambda it: str(it.product_id))

    sale_id = uuid4()
    total = sum(it.quantity * it.price - it.discount for it in items)
    total_cost = Decimal("0")

    # RG-2: optional checkout-time payment, in the same atomic transaction as
    # sale creation — closes the gap where a checkout "payments" array sent
    # by the caller was silently ignored and the sale ended up unpaid.
    paid_amount = Decimal("0")
    sale_status = "confirmed"
    if payments:
        for line in payments:
            await verify_cashbox_in_org(db, line.cashbox_id, org_id)
            await verify_payment_type_in_org(db, line.payment_type_id, org_id)
        paid_amount = sum((Decimal(str(line.amount)) for line in payments), Decimal("0"))
        if paid_amount > total:
            raise HTTPException(422, "To'lov summasi sotuv summasidan oshmasligi kerak")
        sale_status = "paid" if paid_amount >= total else "partial"

    await db.execute(
        text(
            "INSERT INTO sales (id, organization_id, customer_id, warehouse_id, currency_id, "
            "rate, total_amount, paid_amount, status, notes, created_by) "
            "VALUES (:id, :o, :cu, :wh, :cur, :r, :t, :pa, :st, :n, :u)"
        ),
        {"id": str(sale_id), "o": org_id,
         "cu": str(customer_id) if customer_id else None,
         "wh": warehouse_id, "cur": currency_id, "r": rate,
         "t": total, "pa": paid_amount, "st": sale_status, "n": notes, "u": user_id},
    )

    for it in items:
        item_res = await db.execute(
            text("INSERT INTO sale_items (sale_id, product_id, quantity, price, discount) "
                 "VALUES (:s, :p, :q, :pr, :d) RETURNING id"),
            {"s": str(sale_id), "p": str(it.product_id), "q": it.quantity,
             "pr": it.price, "d": it.discount},
        )
        sale_item_id = item_res.scalar()

        # Snapshot avg_cost before stock is deducted (FOR UPDATE locks the balance row).
        # Falls back to products.purchase_price if no balance row exists yet.
        cost_row = await db.execute(
            text("SELECT COALESCE(avg_cost, 0) FROM stock_balances "
                 "WHERE warehouse_id = :w AND product_id = :p FOR UPDATE"),
            {"w": warehouse_id, "p": str(it.product_id)},
        )
        cost_snapshot = Decimal(str(cost_row.scalar() or 0))
        if cost_snapshot == 0:
            fallback = await db.execute(
                text("SELECT COALESCE(purchase_price, 0) FROM products WHERE id = :p"),
                {"p": str(it.product_id)},
            )
            cost_snapshot = Decimal(str(fallback.scalar() or 0))

        await db.execute(
            text("UPDATE sale_items SET unit_cost = :c WHERE id = :sid"),
            {"c": cost_snapshot, "sid": sale_item_id},
        )
        total_cost += Decimal(str(it.quantity)) * cost_snapshot

        # Check BOM before stock deduction: BOM parent products do not hold stock
        # themselves — their components do. Allow negative balance for BOM parents
        # since stock is tracked and deducted at the component level during pick.
        leaves = await explode_bom(db, org_id, str(it.product_id), Decimal(str(it.quantity)))
        is_bom_parent = bool(leaves)

        await _stock_apply(
            db,
            warehouse_id=warehouse_id,
            product_id=str(it.product_id),
            delta_qty=Decimal(str(-it.quantity)),
            cost=cost_snapshot,
            org_id=org_id,
            allow_negative=is_bom_parent,
            operation_type="sale",
            source_type=source_type,
            source_id=str(sale_id),
            user_id=user_id,
        )

        # Pick workflow bootstrap: create pending pick items.
        # BOM products → one pick_item per leaf component (parent_product_id = sold product).
        # Non-BOM products → one pick_item for the product itself (parent_product_id NULL).
        if leaves:
            for leaf in leaves:
                await db.execute(
                    text(
                        "INSERT INTO order_pick_items "
                        "  (organization_id, order_id, item_id, parent_product_id,"
                        "   product_id, quantity, unit_id, status) "
                        "VALUES (:o, :oid, :iid, :parent, :cpid, :q, :u, 'pending') "
                        "ON CONFLICT (organization_id, order_id, item_id, product_id) DO NOTHING"
                    ),
                    {
                        "o": org_id,
                        "oid": str(sale_id),
                        "iid": sale_item_id,
                        "parent": str(it.product_id),
                        "cpid": leaf["component_id"],
                        "q": leaf["quantity"],
                        "u": leaf["unit_id"],
                    },
                )
        else:
            unit_res = await db.execute(
                text("SELECT unit_id FROM products WHERE id = :pid"),
                {"pid": str(it.product_id)},
            )
            unit_row = unit_res.first()
            unit_id = unit_row.unit_id if unit_row else None
            await db.execute(
                text(
                    "INSERT INTO order_pick_items "
                    "  (organization_id, order_id, item_id, parent_product_id,"
                    "   product_id, quantity, unit_id, status) "
                    "VALUES (:o, :oid, :iid, NULL, :pid, :q, :u, 'pending') "
                    "ON CONFLICT (organization_id, order_id, item_id, product_id) DO NOTHING"
                ),
                {
                    "o": org_id,
                    "oid": str(sale_id),
                    "iid": sale_item_id,
                    "pid": str(it.product_id),
                    "q": it.quantity,
                    "u": unit_id,
                },
            )

    for line in payments or []:
        await db.execute(
            text("INSERT INTO cash_movements (organization_id, cashbox_id, direction, "
                 "amount, payment_type_id, customer_id, sale_id, description, created_by) "
                 "VALUES (:o, :cb, 'in', :amt, :pt, :cu, :s, :d, :u)"),
            {"o": org_id, "cb": line.cashbox_id, "amt": line.amount, "pt": line.payment_type_id,
             "cu": str(customer_id) if customer_id else None, "s": str(sale_id),
             "d": "Checkout to'lovi", "u": user_id},
        )
        if line.cashbox_id:
            await db.execute(
                text("UPDATE cashboxes SET balance = balance + :amt WHERE id = :cb"),
                {"amt": line.amount, "cb": line.cashbox_id},
            )

    # Accounting: Dr Mijozlar qarzi / Cr Sotuvdan tushum (+ Dr COGS / Cr Zaxira).
    # Best-effort — a bug here must never block the sale itself.
    try:
        ar_id = await get_default_account_id(db, org_id, "ar")
        revenue_id = await get_default_account_id(db, org_id, "revenue")
        lines = [
            JournalLine(ar_id, debit=float(total), rate=float(rate or 1), currency_id=currency_id,
                        counterparty_type="customer" if customer_id else None,
                        counterparty_id=str(customer_id) if customer_id else None),
            JournalLine(revenue_id, credit=float(total), rate=float(rate or 1), currency_id=currency_id),
        ]
        if total_cost > 0:
            cogs_id = await get_default_account_id(db, org_id, "cogs")
            inventory_id = await get_default_account_id(db, org_id, "inventory")
            lines += [
                JournalLine(cogs_id, debit=float(total_cost)),
                JournalLine(inventory_id, credit=float(total_cost)),
            ]
        await post_journal_entry(
            db, org_id, lines, source_type=source_type, source_id=str(sale_id),
            description=f"Sotuv #{sale_id}", user_id=user_id,
        )
    except Exception:
        log.exception("Failed to post journal entry for sale %s", sale_id)

    # Accounting for checkout-time payment: Dr Kassa / Cr Mijozlar qarzi per line,
    # mirroring /sales/{id}/pay's own best-effort journal entry.
    for line in payments or []:
        try:
            cash_id = await get_cashbox_account_id(db, org_id, line.cashbox_id)
            ar_id = await get_default_account_id(db, org_id, "ar")
            await post_journal_entry(
                db, org_id,
                [
                    JournalLine(cash_id, debit=float(line.amount)),
                    JournalLine(ar_id, credit=float(line.amount),
                                counterparty_type="customer" if customer_id else None,
                                counterparty_id=str(customer_id) if customer_id else None),
                ],
                source_type="sale_payment", source_id=str(sale_id),
                description=f"Checkout to'lovi #{sale_id}", user_id=user_id,
            )
        except Exception:
            log.exception("Failed to post journal entry for checkout payment on sale %s", sale_id)

    # RG-6: earn-on-pay — a brand-new sale that's immediately fully paid via
    # checkout-time `payments` also earns loyalty points (same "sale paid"
    # event as /sales/{id}/pay, just reached at creation time instead).
    loyalty_earned = Decimal("0")
    if sale_status == "paid":
        loyalty_earned = await loyalty_service.earn_on_pay(
            db, org_id, str(customer_id) if customer_id else None, str(sale_id), total, user_id,
        )

    await db.commit()

    return SaleCreateResult(
        sale_id=str(sale_id), total_amount=total, total_cost=total_cost, paid_amount=paid_amount,
        loyalty_earned=loyalty_earned,
    )
