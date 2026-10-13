"""Customer-specific and segment price resolution (B2B pricing overrides).

Precedence: customer_product_prices (exact customer+product match) >
customer_categories.discount_pct (segment percent-off of base_price) >
base_price unchanged. customer_id=None (B2C guest) always short-circuits to
base_price with zero DB queries.
"""
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def resolve_customer_price(
    db: AsyncSession,
    org_id: str,
    customer_id: str | None,
    product_id: str,
    base_price: Decimal,
) -> Decimal:
    if customer_id is None:
        return base_price

    override_res = await db.execute(
        text(
            "SELECT price FROM customer_product_prices "
            "WHERE organization_id = :o AND customer_id = :c AND product_id = :p"
        ),
        {"o": org_id, "c": str(customer_id), "p": str(product_id)},
    )
    override = override_res.scalar()
    if override is not None:
        return Decimal(str(override))

    discount_res = await db.execute(
        text(
            "SELECT cc.discount_pct FROM customers c "
            "JOIN customer_categories cc ON cc.id = c.category_id AND cc.organization_id = :o "
            "WHERE c.organization_id = :o AND c.id = :c"
        ),
        {"o": org_id, "c": str(customer_id)},
    )
    discount_pct = discount_res.scalar()
    if discount_pct is not None:
        pct = Decimal(str(discount_pct))
        return (base_price * (Decimal("1") - pct / Decimal("100"))).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

    return base_price


async def resolve_customer_prices_batch(
    db: AsyncSession,
    org_id: str,
    customer_id: str | None,
    product_base_prices: dict[str, Decimal],
) -> dict[str, Decimal]:
    if customer_id is None or not product_base_prices:
        return dict(product_base_prices)

    product_ids = list(product_base_prices.keys())

    overrides_res = await db.execute(
        text(
            "SELECT product_id, price FROM customer_product_prices "
            "WHERE organization_id = :o AND customer_id = :c "
            "AND product_id = ANY(CAST(:ids AS uuid[]))"
        ),
        {"o": org_id, "c": str(customer_id), "ids": product_ids},
    )
    overrides = {str(r.product_id): Decimal(str(r.price)) for r in overrides_res}

    discount_res = await db.execute(
        text(
            "SELECT cc.discount_pct FROM customers c "
            "JOIN customer_categories cc ON cc.id = c.category_id AND cc.organization_id = :o "
            "WHERE c.organization_id = :o AND c.id = :c"
        ),
        {"o": org_id, "c": str(customer_id)},
    )
    discount_row = discount_res.first()
    discount_pct = Decimal(str(discount_row.discount_pct)) if discount_row else None

    result: dict[str, Decimal] = {}
    for pid, base_price in product_base_prices.items():
        if pid in overrides:
            result[pid] = overrides[pid]
        elif discount_pct is not None:
            result[pid] = (base_price * (Decimal("1") - discount_pct / Decimal("100"))).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
        else:
            result[pid] = base_price
    return result
