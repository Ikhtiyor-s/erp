"""Kiosk catalog + checkout orchestration (tickets/SC-3-kiosk-checkout-flow.md).

Calls sale/service.py::create_sale_core() for the real sale/stock/accounting
write — never duplicates its logic (SPEC MUST: "yangi, parallel sotuv-yozish
yo'li qurilmasin", this ticket is shared by 3 other callers: staff POS, B2B
portal, B2C storefront). Deliberately an independent module, not an import
from storefront/ (DESIGN-self-checkout-auth.md: kiosk is a copied pattern —
different auth model, different risk profile, see that doc for the
"nega storefront emas" rationale).
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi import HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.audit.logger import log_action
from app.modules.integration.payments.base import (
    find_or_create_transaction,
    get_payment_settings,
)
from app.modules.sale.service import SaleLineInput, create_sale_core

# Provider codes storefront/router.py already uses for the exact same
# app_settings['online_payments'] surface — no new payment protocol here.
_GATEWAY_PROVIDERS = ("click", "payme")

_NOT_BOUND_TO_WAREHOUSE = "Kassa omborga bog'lanmagan"
_PRODUCT_NOT_FOUND = "Mahsulot topilmadi"
_CART_LIMIT_MESSAGE = "Savat qiymati juda katta — kassaga murojaat qiling"

# Kiosk-eligibility filter (SPEC Scenario 4, Talablar -> Katalog, MUST):
# weight-sold products (kg/g) are invisible to the kiosk full stop — there is
# no manual weight-entry UI for an unattended kiosk. Reused verbatim by the
# catalog queries AND by checkout's price resolution, so a client can never
# buy a product it could never see in the first place.
_CATALOG_WHERE = (
    "p.organization_id = :o AND p.is_active = TRUE AND p.is_archived = FALSE "
    "AND p.is_service = FALSE AND p.barcode IS NOT NULL "
    "AND COALESCE(u.short_name, '') NOT IN ('kg', 'g')"
)
_CATALOG_JOIN = (
    "FROM products p "
    "LEFT JOIN units u ON u.id = p.unit_id "
    "LEFT JOIN currencies cur ON cur.id = p.currency_id "
    "LEFT JOIN stock_balances sb ON sb.warehouse_id = :wid AND sb.product_id = p.id "
)
_CATALOG_COLUMNS = (
    "p.id, p.barcode, p.name, p.image_url, p.sale_price AS price, "
    "cur.code AS currency_code, COALESCE(sb.quantity, 0) AS stock_qty"
)


def _map_catalog_row(m: Any) -> dict[str, Any]:
    price = m["price"]
    return {
        "id": str(m["id"]),
        "barcode": m["barcode"],
        "name": m["name"],
        "image_url": m["image_url"],
        "price": float(price) if price is not None else 0.0,
        "currency_code": m["currency_code"],
        "stock_qty": float(m["stock_qty"]),
    }


async def resolve_device_warehouse(db: AsyncSession, org_id: str, cashbox_id: int) -> int:
    """The device's bound warehouse — cashboxes.warehouse_id via cashbox_id,
    same T-206 "Case 3" pattern GET /kiosk/session already uses. Price and
    stock for every endpoint in this module are always read from this
    warehouse, never from anything the client sends.

    Deliberately re-queried here rather than imported from kiosk/router.py's
    get_kiosk_session: that function lives in the router module, which
    imports this service module, so importing back would be a cycle. The
    query is one cheap SELECT, same duplication trade-off storefront/
    service.py already documents for its own warehouse lookup.
    """
    res = await db.execute(
        text("SELECT warehouse_id FROM cashboxes WHERE id = :c AND organization_id = :o"),
        {"c": cashbox_id, "o": org_id},
    )
    row = res.first()
    if not row or row.warehouse_id is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, _NOT_BOUND_TO_WAREHOUSE)
    return row.warehouse_id


async def get_catalog(
    db: AsyncSession,
    org_id: str,
    warehouse_id: int,
    q: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    where = [_CATALOG_WHERE]
    params: dict[str, Any] = {"o": org_id, "wid": warehouse_id, "lim": limit, "off": offset}
    if q:
        where.append("p.name ILIKE :q")
        params["q"] = f"%{q}%"
    where_sql = " AND ".join(where)

    count_res = await db.execute(
        text(f"SELECT COUNT(*) FROM products p LEFT JOIN units u ON u.id = p.unit_id WHERE {where_sql}"),
        params,
    )
    total = count_res.scalar() or 0

    rows_res = await db.execute(
        text(
            f"SELECT {_CATALOG_COLUMNS} {_CATALOG_JOIN} "
            f"WHERE {where_sql} ORDER BY p.name LIMIT :lim OFFSET :off"
        ),
        params,
    )
    items = [_map_catalog_row(r._mapping) for r in rows_res]
    return {"items": items, "total": total}


async def get_product_by_barcode(
    db: AsyncSession, org_id: str, warehouse_id: int, barcode: str,
) -> dict[str, Any] | None:
    """None covers every "not sellable by this kiosk" case alike (doesn't
    exist, wrong org, inactive/archived/service, or weight-sold) — the
    caller turns that into a plain 404 with no distinct signal, matching
    Scenario 4 (a kg/g product's barcode returns the same "mahsulot
    topilmadi" a nonexistent barcode would)."""
    res = await db.execute(
        text(f"SELECT {_CATALOG_COLUMNS} {_CATALOG_JOIN} WHERE {_CATALOG_WHERE} AND p.barcode = :bc"),
        {"o": org_id, "wid": warehouse_id, "bc": barcode},
    )
    row = res.first()
    return _map_catalog_row(row._mapping) if row else None


async def resolve_checkout_prices(
    db: AsyncSession, org_id: str, product_ids: list[str],
) -> dict[str, Decimal]:
    """Server-side price for every requested product_id, enforcing the exact
    same kiosk-eligibility filter the catalog uses (Scenario 6: any `price`
    the client sends is ignored entirely; this also closes the gap where a
    client could try to checkout a product_id that never appeared in the
    catalog — e.g. a weight-sold or archived product obtained some other
    way — by rejecting it with the same 422 a missing product_id would get)."""
    if not product_ids:
        return {}
    res = await db.execute(
        text(
            "SELECT p.id, p.sale_price FROM products p "
            "LEFT JOIN units u ON u.id = p.unit_id "
            f"WHERE {_CATALOG_WHERE} AND p.id = ANY(CAST(:ids AS uuid[]))"
        ),
        {"o": org_id, "ids": [str(x) for x in product_ids]},
    )
    prices = {str(r.id): Decimal(str(r.sale_price or 0)) for r in res}
    missing = [str(pid) for pid in product_ids if str(pid) not in prices]
    if missing:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{_PRODUCT_NOT_FOUND}: {missing[0]}",
        )
    return prices


async def get_max_cart_amount(db: AsyncSession, org_id: str) -> Decimal | None:
    """app_settings[key='kiosk'].value['max_cart_amount'] — org-level,
    None/unset = unlimited. Same app_settings row GET /kiosk/session already
    reads. No hardcoded default: the owner has not answered this question
    yet (SPEC "Ochiq savollar" #2) — unlimited-by-default is the only
    non-guessing choice."""
    res = await db.execute(
        text("SELECT value FROM app_settings WHERE organization_id = :o AND key = 'kiosk'"),
        {"o": org_id},
    )
    row = res.first()
    if not row or not row.value:
        return None
    cfg = row.value if isinstance(row.value, dict) else json.loads(row.value)
    amount = cfg.get("max_cart_amount")
    return Decimal(str(amount)) if amount is not None else None


_DEFAULT_CART_IDLE_TIMEOUT_MIN = 3


async def get_cart_idle_timeout_min(db: AsyncSession, org_id: str) -> int:
    """app_settings[key='kiosk'].value['cart_idle_timeout_min'] — same
    app_settings['kiosk'] row max_cart_amount already reads. Default 3
    minutes per SPEC-self-checkout.md's "Loss-prevention" SHOULD. Used only
    by SC-4's staff queue (sale/router.py GET /sale/sales) to flag an
    awaiting_payment kiosk sale as stale/idle for sorting/visibility — never
    to auto-cancel it (SC-4: cancellation stays manual-only in V1)."""
    res = await db.execute(
        text("SELECT value FROM app_settings WHERE organization_id = :o AND key = 'kiosk'"),
        {"o": org_id},
    )
    row = res.first()
    if not row or not row.value:
        return _DEFAULT_CART_IDLE_TIMEOUT_MIN
    cfg = row.value if isinstance(row.value, dict) else json.loads(row.value)
    value = cfg.get("cart_idle_timeout_min")
    return int(value) if value is not None else _DEFAULT_CART_IDLE_TIMEOUT_MIN


async def resolve_checkout_payment(
    db: AsyncSession, org_id: str, sale_id: str, total_amount: Decimal,
) -> tuple[str, str | None]:
    """Return (mode, provider) for the checkout response.

    "gateway"/<code> once a provider is enabled (pre-creates the pending
    payment_transactions row so click.py's/payme.py's existing webhook can
    find/update it via apply_payment_to_sale — no new payment protocol code
    here, same wiring storefront/router.py::_resolve_checkout_payment uses).

    "unavailable"/None is today's real, actual state (Scenario 5 — neither
    Click nor Payme has activated merchant credentials anywhere in this
    codebase). Deliberately NOT "manual" (storefront's wording for the same
    situation): a kiosk has no manual/cash fallback at all (SPEC MUST NOT —
    cash is not an accepted kiosk payment method), so "manual" would imply a
    payment path that does not exist here.
    """
    for provider in _GATEWAY_PROVIDERS:
        cfg = await get_payment_settings(db, org_id, provider)
        if cfg.get("enabled"):
            await find_or_create_transaction(db, org_id, provider, None, sale_id, total_amount)
            return "gateway", provider
    return "unavailable", None


async def _next_order_number(db: AsyncSession, org_id: str) -> str:
    year = datetime.now(timezone.utc).year
    res = await db.execute(
        text("SELECT COUNT(*) + 1 AS n FROM kiosk_orders WHERE organization_id = :o"),
        {"o": org_id},
    )
    seq = res.scalar() or 1
    return f"KS-{year}-{seq:05d}"


@dataclass
class KioskCartLine:
    product_id: str
    quantity: Decimal


async def checkout(
    db: AsyncSession, request: Request, device: dict, lines: list[KioskCartLine],
) -> dict[str, Any]:
    """POST /kiosk/checkout orchestration. Order of operations matters:

    1. Resolve warehouse + server-side prices (never trust the client).
    2. Cart-limit check — MUST run before create_sale_core() (Scenario 2):
       no sale row, no stock movement, nothing touched if the cart is over
       the org's configured limit.
    3. create_sale_core() — the one real sale-writing path, tagged
       source_type='sale_kiosk' so SC-4's staff queue / shrinkage reports can
       tell kiosk sales apart from staff-entered ones.
    4. Resolve payment mode via the existing payments surface (no new
       protocol) and record the kiosk_orders + audit_log rows.
    """
    org_id = str(device["organization_id"])
    if not lines:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Savat bo'sh bo'lishi mumkin emas")

    warehouse_id = await resolve_device_warehouse(db, org_id, device["cashbox_id"])
    prices = await resolve_checkout_prices(db, org_id, [line.product_id for line in lines])

    cart_total = sum((prices[line.product_id] * line.quantity for line in lines), Decimal("0"))

    max_cart_amount = await get_max_cart_amount(db, org_id)
    if max_cart_amount is not None and cart_total > max_cart_amount:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"detail": _CART_LIMIT_MESSAGE, "code": "cart_limit_exceeded"},
        )

    currency_res = await db.execute(text("SELECT id FROM currencies WHERE is_base = TRUE LIMIT 1"))
    currency_id = currency_res.scalar()

    sale_items = [
        SaleLineInput(product_id=line.product_id, quantity=line.quantity, price=prices[line.product_id])
        for line in lines
    ]

    result = await create_sale_core(
        db,
        org_id=org_id,
        customer_id=None,
        warehouse_id=warehouse_id,
        currency_id=currency_id,
        rate=Decimal("1"),
        items=sale_items,
        notes=None,
        user_id=None,
        source_type="sale_kiosk",
    )

    payment_mode, payment_provider = await resolve_checkout_payment(
        db, org_id, result.sale_id, result.total_amount,
    )

    order_number = await _next_order_number(db, org_id)
    await db.execute(
        text(
            "INSERT INTO kiosk_orders "
            "(organization_id, sale_id, device_id, order_number, payment_mode, status) "
            "VALUES (:o, :s, :d, :n, :pm, 'awaiting_payment')"
        ),
        {
            "o": org_id, "s": result.sale_id, "d": str(device["id"]),
            "n": order_number, "pm": payment_mode,
        },
    )

    # Full item-level audit entry (product, qty, price, device id),
    # user_id=None — same log_action(..., user_id=None, ...) pattern
    # storefront checkout uses for its own anonymous-checkout audit row.
    await log_action(
        db, org_id, user_id=None, action="create", entity="kiosk_orders",
        entity_id=result.sale_id,
        diff={
            "order_number": order_number,
            "device_id": str(device["id"]),
            "total_amount": str(result.total_amount),
            "items": [
                {
                    "product_id": line.product_id,
                    "quantity": str(line.quantity),
                    "price": str(prices[line.product_id]),
                }
                for line in lines
            ],
        },
        request=request,
    )
    await db.commit()

    return {
        "sale_id": result.sale_id,
        "order_number": order_number,
        "status": "awaiting_payment",
        "total_amount": float(result.total_amount),
        "payment": {"mode": payment_mode, "provider": payment_provider, "payment_url": None},
    }


async def get_order_status(db: AsyncSession, org_id: str, sale_id: str) -> dict[str, Any] | None:
    """Live status for GET /kiosk/order/{sale_id} — see kiosk/router.py's
    docstring on that endpoint for the full SC-5 polling contract.

    Computed fresh from sales.status/payment_transactions on every call,
    never from a stored timer: sales.status only ever becomes 'paid' via
    apply_payment_to_sale() (click.py's/payme.py's existing webhook, which
    only fires for a real, enabled provider) or 'cancelled' via a staff
    member calling the existing POST /sale/sales/{id}/cancel. Nothing in
    this module advances it on elapsed time — see
    test_kiosk_checkout.py::test_unpaid_order_never_auto_confirms_after_timeout.

    kiosk_orders.status is opportunistically re-synced to match this live
    value (a cheap self-heal of this module's own cache column, written only
    here, in our own table — not a new payment protocol), but the value
    returned to the caller is always the freshly computed one.
    """
    res = await db.execute(
        text(
            "SELECT ko.id AS kiosk_order_id, ko.order_number, ko.payment_mode, "
            "ko.status AS cached_status, s.status AS sale_status, s.total_amount "
            "FROM kiosk_orders ko JOIN sales s ON s.id = ko.sale_id "
            "WHERE ko.organization_id = :o AND ko.sale_id = :sid"
        ),
        {"o": org_id, "sid": sale_id},
    )
    row = res.first()
    if not row:
        return None
    m = row._mapping

    live_status = "awaiting_payment"
    if m["sale_status"] == "cancelled":
        live_status = "cancelled"
    elif m["sale_status"] == "paid":
        live_status = "paid"
    else:
        tx_res = await db.execute(
            text(
                "SELECT status FROM payment_transactions "
                "WHERE organization_id = :o AND sale_id = :sid "
                "ORDER BY created_at DESC LIMIT 1"
            ),
            {"o": org_id, "sid": sale_id},
        )
        tx_row = tx_res.first()
        if tx_row and tx_row.status in ("failed", "cancelled"):
            live_status = "payment_failed"

    if live_status != m["cached_status"]:
        await db.execute(
            text("UPDATE kiosk_orders SET status = :s WHERE id = :id"),
            {"s": live_status, "id": m["kiosk_order_id"]},
        )
        await db.commit()

    return {
        "sale_id": sale_id,
        "order_number": m["order_number"],
        "status": live_status,
        "total_amount": float(m["total_amount"] or 0),
        "payment": {"mode": m["payment_mode"]},
    }
