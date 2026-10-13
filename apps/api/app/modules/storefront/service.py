"""Public (anonymous) B2C storefront catalog — read-only, org-scoped via org_code.

No auth dependency anywhere in this module (by design — see
tickets/DESIGN-ecommerce-b2c.md). Every query is org-scoped and every SELECT
on `products` uses an explicit column whitelist — `purchase_price`/`avg_cost`
must never appear in a response.
"""
import json
from decimal import Decimal
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# Matches the only existing low-stock convention in the codebase
# (assistant/tools.py::get_low_stock, also reused by statistics/router.py and
# integration/telegram.py): recommended_stock.min_qty per (warehouse, product),
# falling back to 5 units when no recommended_stock row exists.
_DEFAULT_LOW_STOCK_THRESHOLD = Decimal("5")


def _classify_stock(qty: Decimal, threshold: Decimal) -> str:
    if qty <= 0:
        return "out_of_stock"
    if qty <= threshold:
        return "low"
    return "in_stock"


async def resolve_org_by_code(db: AsyncSession, org_code: str) -> str:
    """Resolve a public org_code to an active organization id, or 404."""
    res = await db.execute(
        text("SELECT id FROM organizations WHERE UPPER(code) = :c AND is_active = TRUE"),
        {"c": org_code.upper()},
    )
    row = res.first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Tashkilot topilmadi")
    return str(row.id)


async def _get_online_warehouse_id(db: AsyncSession, org_id: str) -> int | None:
    """app_settings[key='ecommerce'].value['online_warehouse_id'] for this org.

    Deliberately NOT imported from sale/service.py::get_online_warehouse_id —
    that file is owned by a parallel ticket (EC-3/EC-6) and may not exist yet.
    Both read the exact same app_settings row/key, so behavior stays identical
    once sale/service.py lands; this is a cheap, dependency-free duplicate.
    """
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


async def find_or_create_guest_customer(
    db: AsyncSession, org_id: str, phone: str, name: str,
) -> dict[str, Any]:
    """Guest-customer dedup by phone only (DESIGN "(c)").

    Serializes concurrent checkouts for the same (org, phone) via an advisory
    xact lock (released automatically on commit/rollback), then looks up an
    existing customer by exact phone match. If found, the existing name wins
    (a guest's one-off typo must not overwrite the real customer record). If
    not found, inserts a new customer row with category_id=NULL — no pricing
    segment/contract override is possible for an anonymous guest.
    """
    await db.execute(
        text("SELECT pg_advisory_xact_lock(hashtextextended(:k, 0))"),
        {"k": f"{org_id}:{phone}"},
    )
    res = await db.execute(
        text("SELECT id, name FROM customers WHERE organization_id = :o AND phone = :p LIMIT 1"),
        {"o": org_id, "p": phone},
    )
    row = res.first()
    if row:
        return {"id": str(row.id), "name": row.name}

    ins = await db.execute(
        text(
            "INSERT INTO customers (organization_id, name, phone, category_id) "
            "VALUES (:o, :n, :p, NULL) RETURNING id, name"
        ),
        {"o": org_id, "n": name, "p": phone},
    )
    new_row = ins.first()
    return {"id": str(new_row.id), "name": new_row.name}


async def get_published_prices(
    db: AsyncSession, org_id: str, product_ids: list[str],
) -> dict[str, Decimal]:
    """Resolve products.sale_price for every requested product_id, enforcing
    that each one is published to this org's storefront (is_published_online)
    on top of the org/active/archived checks create_sale_core already does —
    create_sale_core has no concept of is_published_online, so a B2C guest
    must not be able to buy a product that's valid-in-org but not published.
    """
    if not product_ids:
        return {}
    res = await db.execute(
        text(
            "SELECT id, sale_price FROM products "
            "WHERE id = ANY(CAST(:ids AS uuid[])) AND organization_id = :o "
            "AND is_published_online = TRUE AND is_active = TRUE AND is_archived = FALSE"
        ),
        {"ids": [str(x) for x in product_ids], "o": org_id},
    )
    prices = {str(r.id): Decimal(str(r.sale_price or 0)) for r in res}
    missing = [str(pid) for pid in product_ids if str(pid) not in prices]
    if missing:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Mahsulot onlayn do'konda mavjud emas: {missing[0]}",
        )
    return prices


async def get_categories(db: AsyncSession, org_id: str) -> dict[str, Any]:
    """Categories that have at least one published/active/non-archived product."""
    res = await db.execute(
        text(
            "SELECT c.id, c.name, COUNT(p.id) AS product_count "
            "FROM product_categories c "
            "JOIN products p ON p.category_id = c.id "
            "WHERE c.organization_id = :o AND p.organization_id = :o "
            "AND p.is_published_online = TRUE AND p.is_active = TRUE AND p.is_archived = FALSE "
            "GROUP BY c.id, c.name "
            "HAVING COUNT(p.id) > 0 "
            "ORDER BY c.name"
        ),
        {"o": org_id},
    )
    items = [
        {"id": r.id, "name": r.name, "product_count": r.product_count}
        for r in res
    ]
    return {"items": items}


# Column whitelist shared by get_catalog() and get_product() — the single
# source of truth for what a public /shop/products* response is allowed to
# contain. Never add purchase_price/avg_cost/cost here.
_CATALOG_COLUMNS = (
    "p.id, p.name, p.category_id, cat.name AS category_name, "
    "p.image_url, p.sale_price AS price, cur.code AS currency_code, "
    "COALESCE(sb.quantity, 0) AS stock_qty, "
    "COALESCE(rs.min_qty, :default_threshold) AS low_stock_threshold"
)
_CATALOG_JOINS = (
    "FROM products p "
    "LEFT JOIN product_categories cat ON cat.id = p.category_id "
    "LEFT JOIN currencies cur ON cur.id = p.currency_id "
    "LEFT JOIN stock_balances sb ON sb.warehouse_id = :wid AND sb.product_id = p.id "
    "LEFT JOIN recommended_stock rs ON rs.warehouse_id = :wid AND rs.product_id = p.id "
)


def _map_catalog_row(m: Any) -> dict[str, Any]:
    qty = Decimal(str(m["stock_qty"]))
    threshold = Decimal(str(m["low_stock_threshold"]))
    price = m["price"]
    return {
        "id": str(m["id"]),
        "name": m["name"],
        "category_id": m["category_id"],
        "category_name": m["category_name"],
        "image_url": m["image_url"],
        "price": float(price) if price is not None else 0.0,
        "currency_code": m["currency_code"],
        "stock_status": _classify_stock(qty, threshold),
    }


async def get_catalog(
    db: AsyncSession,
    org_id: str,
    category_id: int | None = None,
    q: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> dict[str, Any]:
    """Public product catalog for one org. 200 + configured=False when the
    org hasn't set an online warehouse yet ("shop temporarily closed")."""
    warehouse_id = await _get_online_warehouse_id(db, org_id)
    if warehouse_id is None:
        return {"configured": False, "items": [], "total": 0}

    where = [
        "p.organization_id = :o",
        "p.is_published_online = TRUE",
        "p.is_active = TRUE",
        "p.is_archived = FALSE",
    ]
    params: dict[str, Any] = {
        "o": org_id,
        "wid": warehouse_id,
        "lim": limit,
        "off": offset,
    }
    if category_id is not None:
        where.append("p.category_id = :cat")
        params["cat"] = category_id
    if q:
        where.append("p.name ILIKE :q")
        params["q"] = f"%{q}%"
    where_sql = " AND ".join(where)

    count_res = await db.execute(
        text(f"SELECT COUNT(*) FROM products p WHERE {where_sql}"),
        params,
    )
    total = count_res.scalar() or 0

    rows_res = await db.execute(
        text(
            f"SELECT {_CATALOG_COLUMNS} "
            f"{_CATALOG_JOINS}"
            f"WHERE {where_sql} "
            "ORDER BY p.name LIMIT :lim OFFSET :off"
        ),
        {**params, "default_threshold": _DEFAULT_LOW_STOCK_THRESHOLD},
    )

    items = [_map_catalog_row(r._mapping) for r in rows_res]

    return {"configured": True, "items": items, "total": total}


async def get_product(db: AsyncSession, org_id: str, product_id: str) -> dict[str, Any] | None:
    """Single published product by id — same column whitelist/joins as
    get_catalog(). None covers every "not visible to this org's storefront"
    case (doesn't exist, wrong org, unpublished/inactive/archived, or the org
    has no online warehouse configured) — the caller turns that into a plain
    404, with no distinct signal for "exists but hidden" vs "doesn't exist"."""
    warehouse_id = await _get_online_warehouse_id(db, org_id)
    if warehouse_id is None:
        return None

    res = await db.execute(
        text(
            f"SELECT {_CATALOG_COLUMNS} "
            f"{_CATALOG_JOINS}"
            "WHERE p.id = :pid AND p.organization_id = :o "
            "AND p.is_published_online = TRUE AND p.is_active = TRUE AND p.is_archived = FALSE"
        ),
        {
            "pid": product_id, "o": org_id, "wid": warehouse_id,
            "default_threshold": _DEFAULT_LOW_STOCK_THRESHOLD,
        },
    )
    row = res.first()
    return _map_catalog_row(row._mapping) if row else None


async def get_order(db: AsyncSession, org_id: str, sale_id: str) -> dict[str, Any] | None:
    """Storefront order-confirmation lookup, keyed by `sale_id` (a
    non-enumerable UUID — the real lookup secret, same trust model the
    checkout response already uses by returning it as the primary
    identifier). `org_id` keeps this query consistently org-scoped like
    every other /shop endpoint, not as a security boundary (org_code is
    public).

    `payment.provider` is read from the `payment_transactions` row
    `_resolve_checkout_payment` already persisted at checkout time — it is
    NOT re-derived from today's `online_payments` settings, so toggling a
    provider off after the order was placed doesn't change what an old
    order reports.
    """
    res = await db.execute(
        text(
            "SELECT so.sale_id, so.order_number, so.status, so.payment_mode, "
            "s.total_amount "
            "FROM storefront_orders so "
            "JOIN sales s ON s.id = so.sale_id "
            "WHERE so.organization_id = :o AND so.sale_id = :sid"
        ),
        {"o": org_id, "sid": sale_id},
    )
    row = res.first()
    if not row:
        return None
    m = row._mapping

    provider = None
    if m["payment_mode"] == "gateway":
        tx_res = await db.execute(
            text(
                "SELECT provider FROM payment_transactions "
                "WHERE organization_id = :o AND sale_id = :sid "
                "ORDER BY created_at DESC LIMIT 1"
            ),
            {"o": org_id, "sid": sale_id},
        )
        tx_row = tx_res.first()
        provider = tx_row.provider if tx_row else None

    return {
        "sale_id": str(m["sale_id"]),
        "order_number": m["order_number"],
        "status": m["status"],
        "total_amount": float(m["total_amount"] or 0),
        "payment": {"mode": m["payment_mode"], "provider": provider, "payment_url": None},
    }
