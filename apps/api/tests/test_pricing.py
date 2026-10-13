"""Unit tests for customer/pricing.py — pure function logic, AsyncSession mocked.

No live DB needed (see tests/conftest.py docstring — the rest of this suite
is httpx-integration-style against a live server, unavailable in this
sandbox). These were additionally verified against a real Postgres 16
instance in a throwaway container during development; see the ticket report.
"""
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.modules.customer.pricing import resolve_customer_price, resolve_customer_prices_batch


def _db_with_scalars(*scalars):
    """Build a mock AsyncSession whose .execute() calls return, in order,
    results whose .scalar() yields each of `scalars`."""
    db = AsyncMock()
    results = []
    for val in scalars:
        res = MagicMock()
        res.scalar.return_value = val
        results.append(res)
    db.execute.side_effect = results
    return db


@pytest.mark.asyncio
async def test_precedence_customer_over_segment():
    # First query (override lookup) returns a price -> segment query must never run.
    db = _db_with_scalars(Decimal("7000.00"))
    price = await resolve_customer_price(db, "org1", "cust1", "prod1", Decimal("10000"))
    assert price == Decimal("7000.00")
    assert db.execute.await_count == 1  # segment query short-circuited


@pytest.mark.asyncio
async def test_precedence_segment_over_standard():
    # Override lookup -> None, segment lookup -> 10% discount.
    db = _db_with_scalars(None, Decimal("10"))
    price = await resolve_customer_price(db, "org1", "cust1", "prod1", Decimal("10000"))
    assert price == Decimal("9000.00")
    assert db.execute.await_count == 2


@pytest.mark.asyncio
async def test_no_override_returns_base_price():
    db = _db_with_scalars(None, None)
    price = await resolve_customer_price(db, "org1", "cust1", "prod1", Decimal("10000"))
    assert price == Decimal("10000")


@pytest.mark.asyncio
async def test_guest_customer_id_none_skips_lookup():
    db = AsyncMock()
    price = await resolve_customer_price(db, "org1", None, "prod1", Decimal("10000"))
    assert price == Decimal("10000")
    db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_cross_tenant_price_isolation():
    """Every query this function issues must be filtered by the caller's org_id —
    a customer/product pair from a different org can never leak through."""
    db = _db_with_scalars(None, None)
    await resolve_customer_price(db, "org-A", "cust1", "prod1", Decimal("10000"))
    for call in db.execute.await_args_list:
        params = call.args[1]
        assert params["o"] == "org-A"


@pytest.mark.asyncio
async def test_batch_guest_customer_id_none_zero_queries():
    db = AsyncMock()
    prices = {"p1": Decimal("100"), "p2": Decimal("200")}
    result = await resolve_customer_prices_batch(db, "org1", None, prices)
    assert result == prices
    db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_batch_empty_products_zero_queries():
    db = AsyncMock()
    result = await resolve_customer_prices_batch(db, "org1", "cust1", {})
    assert result == {}
    db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_batch_precedence_customer_over_segment():
    override_rows = [MagicMock(product_id="p1", price=Decimal("50"))]
    overrides_res = MagicMock()
    overrides_res.__iter__.return_value = iter(override_rows)

    discount_res = MagicMock()
    discount_res.first.return_value = MagicMock(discount_pct=Decimal("10"))

    db = AsyncMock()
    db.execute.side_effect = [overrides_res, discount_res]

    result = await resolve_customer_prices_batch(
        db, "org1", "cust1", {"p1": Decimal("100"), "p2": Decimal("200")}
    )
    assert result["p1"] == Decimal("50")          # override wins
    assert result["p2"] == Decimal("180.00")       # 10% off base
