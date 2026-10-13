"""EC-5/EC-6 — B2C public storefront API unit tests.

No live DB/server available this sprint (confirmed by a prior agent via
`docker ps`) — these tests mock AsyncSession.execute() instead of hitting a
real database. They assert on the exact SQL text + bound params sent to the
DB (org-scoping, status filters, parameterization) and on the service-layer
response shape (the output whitelist that guarantees cost fields never leak),
which is exactly what matters for this ticket's "Done means" criteria.

EC-6 (checkout) additionally verified end-to-end against a real throwaway
postgres:16-alpine + the api's own python:3.12-slim Docker image this
sprint (happy path, guest dedup, cross-org rejection, unpublished-product
rejection, invalid phone, missing online_warehouse_id 503, and the
concurrent-last-unit stock race) — see the EC-6 ticket report for details;
that run isn't checked into this file since it depends on a disposable
container, but the unit tests below cover the same service-layer logic.
"""
import asyncio
import os
import random
import uuid
from decimal import Decimal
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.modules.rbac.middleware import required_permission
from app.modules.storefront import service as storefront_service
from app.modules.storefront.router import CheckoutItemIn, _resolve_checkout_payment

API_URL = os.environ.get("API_URL", "http://localhost:8000")

FROZEN_PRODUCT_KEYS = {
    "id", "name", "category_id", "category_name",
    "image_url", "price", "currency_code", "stock_status",
}
FORBIDDEN_KEYS = {"purchase_price", "avg_cost", "cost"}


class _FakeRow:
    def __init__(self, mapping: dict):
        self._mapping = mapping
        for k, v in mapping.items():
            setattr(self, k, v)


class _FakeResult:
    def __init__(self, rows=None, scalar_value=None):
        self._rows = rows or []
        self._scalar_value = scalar_value

    def scalar(self):
        return self._scalar_value

    def first(self):
        return self._rows[0] if self._rows else None

    def __iter__(self):
        return iter(self._rows)


# ---------------------------------------------------------------------------
# RBAC: /api/v1/shop/* must never require a permission (anonymous surface)
# ---------------------------------------------------------------------------

def test_shop_paths_skip_permission_middleware():
    assert required_permission("GET", "/api/v1/shop/categories") is None
    assert required_permission("GET", "/api/v1/shop/products") is None
    assert required_permission("GET", "/api/v1/shop/products?org_code=DEMO1") is None
    assert required_permission("GET", "/api/v1/shop/products/11111111-1111-1111-1111-111111111111") is None
    assert required_permission("GET", "/api/v1/shop/order/11111111-1111-1111-1111-111111111111") is None


# ---------------------------------------------------------------------------
# Pure stock-status threshold logic
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("qty,threshold,expected", [
    (Decimal("0"), Decimal("5"), "out_of_stock"),
    (Decimal("-1"), Decimal("5"), "out_of_stock"),
    (Decimal("1"), Decimal("5"), "low"),
    (Decimal("5"), Decimal("5"), "low"),
    (Decimal("6"), Decimal("5"), "in_stock"),
    (Decimal("100"), Decimal("5"), "in_stock"),
])
def test_stock_status_thresholds(qty, threshold, expected):
    assert storefront_service._classify_stock(qty, threshold) == expected


# ---------------------------------------------------------------------------
# resolve_org_by_code
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_resolve_org_by_code_success():
    db = AsyncMock()
    db.execute.return_value = _FakeResult(rows=[_FakeRow({"id": "org-123"})])

    org_id = await storefront_service.resolve_org_by_code(db, "demo1")

    assert org_id == "org-123"
    sql, params = db.execute.call_args.args
    assert "is_active = TRUE" in str(sql)
    assert params["c"] == "DEMO1"  # uppercased, matches customer_portal convention


@pytest.mark.asyncio
async def test_resolve_org_by_code_not_found_raises_404():
    from fastapi import HTTPException

    db = AsyncMock()
    db.execute.return_value = _FakeResult(rows=[])

    with pytest.raises(HTTPException) as exc_info:
        await storefront_service.resolve_org_by_code(db, "NOPE")

    assert exc_info.value.status_code == 404


# ---------------------------------------------------------------------------
# get_catalog — "shop temporarily closed" (no online_warehouse_id configured)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_catalog_not_configured_returns_200_shape(monkeypatch):
    async def fake_no_warehouse(db, org_id):
        return None

    monkeypatch.setattr(storefront_service, "_get_online_warehouse_id", fake_no_warehouse)
    db = AsyncMock()

    result = await storefront_service.get_catalog(db, "org-1")

    assert result == {"configured": False, "items": [], "total": 0}
    db.execute.assert_not_called()


# ---------------------------------------------------------------------------
# get_catalog — org isolation + status filters actually present in SQL
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_catalog_excludes_unpublished_and_scopes_org(monkeypatch):
    async def fake_warehouse(db, org_id):
        return 7

    monkeypatch.setattr(storefront_service, "_get_online_warehouse_id", fake_warehouse)
    db = AsyncMock()
    db.execute.side_effect = [
        _FakeResult(scalar_value=0),
        _FakeResult(rows=[]),
    ]

    await storefront_service.get_catalog(
        db, "org-xyz", category_id=3, q="cola", limit=10, offset=5,
    )

    count_call, rows_call = db.execute.call_args_list
    count_sql, count_params = count_call.args
    rows_sql, rows_params = rows_call.args

    for sql, params in ((str(count_sql), count_params), (str(rows_sql), rows_params)):
        assert "p.organization_id = :o" in sql
        assert "p.is_published_online = TRUE" in sql
        assert "p.is_active = TRUE" in sql
        assert "p.is_archived = FALSE" in sql
        assert params["o"] == "org-xyz"

    assert "p.category_id = :cat" in str(rows_sql)
    assert rows_params["cat"] == 3
    assert rows_params["q"] == "%cola%"
    assert rows_params["wid"] == 7
    assert rows_params["lim"] == 10
    assert rows_params["off"] == 5
    assert "purchase_price" not in str(rows_sql)
    assert "avg_cost" not in str(rows_sql)
    assert "SELECT *" not in str(rows_sql)


# ---------------------------------------------------------------------------
# get_catalog — response never leaks cost fields even if a row carries them
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_catalog_never_leaks_cost_fields(monkeypatch):
    async def fake_warehouse(db, org_id):
        return 1

    monkeypatch.setattr(storefront_service, "_get_online_warehouse_id", fake_warehouse)

    # Simulate a row that (hypothetically, e.g. after a future SQL edit)
    # carries internal financial columns too -- the service's explicit
    # output-whitelist must still drop them.
    fake_row = _FakeRow({
        "id": "11111111-1111-1111-1111-111111111111",
        "name": "Coca-Cola 1.5L",
        "category_id": 3,
        "category_name": "Ichimliklar",
        "image_url": "https://example.test/cola.jpg",
        "price": Decimal("18000.00"),
        "currency_code": "UZS",
        "stock_qty": Decimal("10"),
        "low_stock_threshold": Decimal("5"),
        "purchase_price": Decimal("12000.00"),
        "avg_cost": Decimal("11500.00"),
    })
    db = AsyncMock()
    db.execute.side_effect = [
        _FakeResult(scalar_value=1),
        _FakeResult(rows=[fake_row]),
    ]

    result = await storefront_service.get_catalog(db, "org-1")

    assert result["configured"] is True
    assert result["total"] == 1
    item = result["items"][0]
    assert set(item.keys()) == FROZEN_PRODUCT_KEYS
    assert not (set(item.keys()) & FORBIDDEN_KEYS)
    assert item["price"] == 18000.0
    assert item["stock_status"] == "in_stock"


@pytest.mark.asyncio
async def test_catalog_stock_status_out_of_stock_and_low(monkeypatch):
    async def fake_warehouse(db, org_id):
        return 1

    monkeypatch.setattr(storefront_service, "_get_online_warehouse_id", fake_warehouse)

    rows = [
        _FakeRow({
            "id": "a", "name": "A", "category_id": None, "category_name": None,
            "image_url": None, "price": Decimal("1000"), "currency_code": "UZS",
            "stock_qty": Decimal("0"), "low_stock_threshold": Decimal("5"),
        }),
        _FakeRow({
            "id": "b", "name": "B", "category_id": None, "category_name": None,
            "image_url": None, "price": Decimal("1000"), "currency_code": "UZS",
            "stock_qty": Decimal("3"), "low_stock_threshold": Decimal("5"),
        }),
    ]
    db = AsyncMock()
    db.execute.side_effect = [_FakeResult(scalar_value=2), _FakeResult(rows=rows)]

    result = await storefront_service.get_catalog(db, "org-1")

    statuses = {item["id"]: item["stock_status"] for item in result["items"]}
    assert statuses == {"a": "out_of_stock", "b": "low"}


# ---------------------------------------------------------------------------
# get_categories
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_categories_filters_published_only():
    db = AsyncMock()
    db.execute.return_value = _FakeResult(rows=[
        _FakeRow({"id": 3, "name": "Ichimliklar", "product_count": 12}),
    ])

    result = await storefront_service.get_categories(db, "org-1")

    assert result == {"items": [{"id": 3, "name": "Ichimliklar", "product_count": 12}]}
    sql, params = db.execute.call_args.args
    sql = str(sql)
    assert "p.is_published_online = TRUE" in sql
    assert "p.is_active = TRUE" in sql
    assert "p.is_archived = FALSE" in sql
    assert "c.organization_id = :o" in sql
    assert params["o"] == "org-1"


# ---------------------------------------------------------------------------
# EC-6 — POST /shop/checkout
# ---------------------------------------------------------------------------

def test_checkout_item_in_rejects_client_supplied_price():
    """DESIGN: items[].price MUST NOT be accepted — rejected by pydantic
    itself (extra="forbid"), not silently dropped."""
    with pytest.raises(ValidationError):
        CheckoutItemIn(product_id="11111111-1111-1111-1111-111111111111", quantity=2, price=1)

    # Still works without price.
    item = CheckoutItemIn(product_id="11111111-1111-1111-1111-111111111111", quantity=2)
    assert item.quantity == 2


@pytest.mark.asyncio
async def test_find_or_create_guest_customer_dedup_keeps_existing_name():
    """DESIGN "(c)": if a customer with this phone already exists, the
    existing name wins — the guest's freshly-typed name is ignored."""
    db = AsyncMock()
    db.execute.side_effect = [
        _FakeResult(),  # pg_advisory_xact_lock
        _FakeResult(rows=[_FakeRow({"id": "cust-1", "name": "Aziz Karimov"})]),
    ]

    result = await storefront_service.find_or_create_guest_customer(
        db, "org-1", "+998901234567", "Typo Name This Time",
    )

    assert result == {"id": "cust-1", "name": "Aziz Karimov"}
    lock_sql, lock_params = db.execute.call_args_list[0].args
    assert "pg_advisory_xact_lock" in str(lock_sql)
    assert lock_params["k"] == "org-1:+998901234567"
    # Only SELECT + lock — no INSERT when an existing row was found.
    assert db.execute.call_count == 2


@pytest.mark.asyncio
async def test_find_or_create_guest_customer_inserts_with_null_category():
    """No existing row -> INSERT with category_id=NULL (no pricing segment
    override possible for an anonymous guest)."""
    db = AsyncMock()
    db.execute.side_effect = [
        _FakeResult(),  # pg_advisory_xact_lock
        _FakeResult(rows=[]),  # no existing customer
        _FakeResult(rows=[_FakeRow({"id": "cust-new", "name": "Aziz Karimov"})]),  # INSERT ... RETURNING
    ]

    result = await storefront_service.find_or_create_guest_customer(
        db, "org-1", "+998901234567", "Aziz Karimov",
    )

    assert result == {"id": "cust-new", "name": "Aziz Karimov"}
    insert_sql, insert_params = db.execute.call_args_list[2].args
    assert "INSERT INTO customers" in str(insert_sql)
    assert "category_id" in str(insert_sql)
    assert insert_params == {"o": "org-1", "n": "Aziz Karimov", "p": "+998901234567"}


@pytest.mark.asyncio
async def test_get_published_prices_returns_sale_price_map():
    db = AsyncMock()
    db.execute.return_value = _FakeResult(rows=[
        _FakeRow({"id": "p1", "sale_price": Decimal("18000.00")}),
    ])

    prices = await storefront_service.get_published_prices(db, "org-1", ["p1"])

    assert prices == {"p1": Decimal("18000.00")}
    sql, params = db.execute.call_args.args
    sql = str(sql)
    assert "is_published_online = TRUE" in sql
    assert "is_active = TRUE" in sql
    assert "is_archived = FALSE" in sql
    assert params["o"] == "org-1"


@pytest.mark.asyncio
async def test_get_published_prices_rejects_unpublished_or_cross_org_product():
    """Covers both DESIGN cases in one assertion path: a product_id missing
    from the published/active/non-archived/same-org result set is 422 —
    whether that's because it's unpublished, archived, or belongs to another
    organization (verify_products_in_org in sale/service.py doesn't know
    about is_published_online, so this check is this ticket's own)."""
    db = AsyncMock()
    db.execute.return_value = _FakeResult(rows=[])  # nothing matches -> all missing

    with pytest.raises(HTTPException) as exc_info:
        await storefront_service.get_published_prices(db, "org-1", ["p1"])

    assert exc_info.value.status_code == 422


@pytest.mark.asyncio
async def test_get_published_prices_empty_list_short_circuits():
    db = AsyncMock()
    result = await storefront_service.get_published_prices(db, "org-1", [])
    assert result == {}
    db.execute.assert_not_called()


# ---------------------------------------------------------------------------
# EC-7 — _resolve_checkout_payment (manual vs gateway branch)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_resolve_checkout_payment_manual_when_no_provider_enabled(monkeypatch):
    """DESIGN Scenario 3: no provider enabled -> mode=manual, provider=None,
    and no payment_transactions row is created (today's real state)."""
    async def fake_settings(db, org_id, provider):
        return {}

    tx_mock = AsyncMock()
    monkeypatch.setattr("app.modules.storefront.router.get_payment_settings", fake_settings)
    monkeypatch.setattr("app.modules.storefront.router.find_or_create_transaction", tx_mock)
    db = AsyncMock()

    mode, provider = await _resolve_checkout_payment(db, "org-1", "sale-1", Decimal("36000"))

    assert (mode, provider) == ("manual", None)
    tx_mock.assert_not_called()


@pytest.mark.asyncio
async def test_resolve_checkout_payment_gateway_when_click_enabled(monkeypatch):
    """DESIGN Scenario 4: click enabled -> mode=gateway, provider='click',
    and find_or_create_transaction is called with this sale_id (no
    provider_tx_id yet — click.py's own webhook prepare stage supplies it)."""
    async def fake_settings(db, org_id, provider):
        return {"enabled": True} if provider == "click" else {}

    tx_mock = AsyncMock(return_value={"id": "tx-1", "status": "pending"})
    monkeypatch.setattr("app.modules.storefront.router.get_payment_settings", fake_settings)
    monkeypatch.setattr("app.modules.storefront.router.find_or_create_transaction", tx_mock)
    db = AsyncMock()

    mode, provider = await _resolve_checkout_payment(db, "org-1", "sale-1", Decimal("36000"))

    assert (mode, provider) == ("gateway", "click")
    tx_mock.assert_awaited_once_with(db, "org-1", "click", None, "sale-1", Decimal("36000"))


@pytest.mark.asyncio
async def test_resolve_checkout_payment_falls_through_to_payme(monkeypatch):
    """click disabled, payme enabled -> payme is picked, proving this isn't
    hardcoded to a single provider."""
    async def fake_settings(db, org_id, provider):
        return {"enabled": provider == "payme"}

    tx_mock = AsyncMock(return_value={"id": "tx-2"})
    monkeypatch.setattr("app.modules.storefront.router.get_payment_settings", fake_settings)
    monkeypatch.setattr("app.modules.storefront.router.find_or_create_transaction", tx_mock)
    db = AsyncMock()

    mode, provider = await _resolve_checkout_payment(db, "org-1", "sale-2", Decimal("1000"))

    assert (mode, provider) == ("gateway", "payme")
    tx_mock.assert_awaited_once_with(db, "org-1", "payme", None, "sale-2", Decimal("1000"))


# ---------------------------------------------------------------------------
# GAP-1 — get_product (GET /shop/products/{product_id})
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_product_not_configured_returns_none(monkeypatch):
    """No online_warehouse_id configured -> None (router turns this into 404,
    same as the list endpoint's "shop closed" case has no browsable catalog)."""
    async def fake_no_warehouse(db, org_id):
        return None

    monkeypatch.setattr(storefront_service, "_get_online_warehouse_id", fake_no_warehouse)
    db = AsyncMock()

    result = await storefront_service.get_product(db, "org-1", "p1")

    assert result is None
    db.execute.assert_not_called()


@pytest.mark.asyncio
async def test_get_product_scopes_org_and_whitelists_columns(monkeypatch):
    async def fake_warehouse(db, org_id):
        return 7

    monkeypatch.setattr(storefront_service, "_get_online_warehouse_id", fake_warehouse)
    db = AsyncMock()
    db.execute.return_value = _FakeResult(rows=[_FakeRow({
        "id": "11111111-1111-1111-1111-111111111111",
        "name": "Coca-Cola 1.5L",
        "category_id": 3,
        "category_name": "Ichimliklar",
        "image_url": None,
        "price": Decimal("18000.00"),
        "currency_code": "UZS",
        "stock_qty": Decimal("10"),
        "low_stock_threshold": Decimal("5"),
    })])

    item = await storefront_service.get_product(db, "org-xyz", "11111111-1111-1111-1111-111111111111")

    sql, params = db.execute.call_args.args
    sql = str(sql)
    assert "p.id = :pid" in sql
    assert "p.organization_id = :o" in sql
    assert "p.is_published_online = TRUE" in sql
    assert "p.is_active = TRUE" in sql
    assert "p.is_archived = FALSE" in sql
    assert "purchase_price" not in sql
    assert "avg_cost" not in sql
    assert "SELECT *" not in sql
    assert params["o"] == "org-xyz"
    assert params["pid"] == "11111111-1111-1111-1111-111111111111"
    assert params["wid"] == 7

    assert set(item.keys()) == FROZEN_PRODUCT_KEYS
    assert not (set(item.keys()) & FORBIDDEN_KEYS)
    assert item["price"] == 18000.0
    assert item["stock_status"] == "in_stock"


@pytest.mark.asyncio
async def test_get_product_not_found_returns_none(monkeypatch):
    """Covers every "not visible to this org" case in one return value: wrong
    org, unpublished, archived, inactive, or simply doesn't exist — no
    distinct signal, router turns all of them into the same plain 404."""
    async def fake_warehouse(db, org_id):
        return 1

    monkeypatch.setattr(storefront_service, "_get_online_warehouse_id", fake_warehouse)
    db = AsyncMock()
    db.execute.return_value = _FakeResult(rows=[])

    result = await storefront_service.get_product(db, "org-1", "missing")

    assert result is None


# ---------------------------------------------------------------------------
# GAP-2 — get_order (GET /shop/order/{sale_id})
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_order_manual_mode_skips_payment_transactions_lookup():
    """payment_mode='manual' -> provider stays None, and no second query
    against payment_transactions is made (nothing was ever persisted there
    for a manual-mode order)."""
    db = AsyncMock()
    db.execute.return_value = _FakeResult(rows=[_FakeRow({
        "sale_id": "11111111-1111-1111-1111-111111111111",
        "order_number": "SF-2026-00042",
        "status": "new",
        "payment_mode": "manual",
        "total_amount": Decimal("36000.00"),
    })])

    order = await storefront_service.get_order(db, "org-1", "11111111-1111-1111-1111-111111111111")

    assert order == {
        "sale_id": "11111111-1111-1111-1111-111111111111",
        "order_number": "SF-2026-00042",
        "status": "new",
        "total_amount": 36000.0,
        "payment": {"mode": "manual", "provider": None, "payment_url": None},
    }
    assert db.execute.call_count == 1
    sql, params = db.execute.call_args.args
    sql = str(sql)
    assert "storefront_orders" in sql
    assert "JOIN sales" in sql
    assert "so.organization_id = :o" in sql
    assert params["o"] == "org-1"


@pytest.mark.asyncio
async def test_get_order_gateway_mode_reports_persisted_provider():
    """payment_mode='gateway' -> provider is read from the payment_transactions
    row find_or_create_transaction already persisted at checkout time (not
    re-derived from today's online_payments settings)."""
    db = AsyncMock()
    db.execute.side_effect = [
        _FakeResult(rows=[_FakeRow({
            "sale_id": "sale-1",
            "order_number": "SF-2026-00099",
            "status": "new",
            "payment_mode": "gateway",
            "total_amount": Decimal("18000.00"),
        })]),
        _FakeResult(rows=[_FakeRow({"provider": "click"})]),
    ]

    order = await storefront_service.get_order(db, "org-1", "sale-1")

    assert order["payment"] == {"mode": "gateway", "provider": "click", "payment_url": None}
    tx_sql, tx_params = db.execute.call_args_list[1].args
    assert "payment_transactions" in str(tx_sql)
    assert tx_params == {"o": "org-1", "sid": "sale-1"}


@pytest.mark.asyncio
async def test_get_order_not_found_returns_none():
    db = AsyncMock()
    db.execute.return_value = _FakeResult(rows=[])

    result = await storefront_service.get_order(db, "org-1", "nope")

    assert result is None


# ---------------------------------------------------------------------------
# REAL end-to-end tests against the live erp-api container (no mocks) —
# drive POST /shop/checkout and its surrounding GETs over real HTTP.
#
# conftest.py's `client` fixture mutates the SAME httpx.AsyncClient instance
# `http_client` returns (it does `http_client.headers.update(...)` and
# returns that same object) — so a test that depends on both `client` and
# `http_client` would get ONE already-authenticated client bound to both
# parameter names, never a genuinely anonymous one. These tests use `client`
# (session admin/org) for authenticated setup + verification, and a fresh,
# separate httpx.AsyncClient for the public /shop/* calls — the same pattern
# test_ecommerce_idempotency.py already uses this session.
# ---------------------------------------------------------------------------

def _rand_phone() -> str:
    return "+998" + "".join(str(random.randint(0, 9)) for _ in range(9))


async def _org_code(client: httpx.AsyncClient, org_id: str) -> str:
    resp = await client.get("/api/v1/organizations/mine")
    assert resp.status_code == 200, resp.text
    return next(o["code"] for o in resp.json() if o["id"] == org_id)


async def _setup_published_product_with_stock(client: httpx.AsyncClient, qty: str) -> dict:
    """Configure the org's online warehouse (PUT /settings/key/ecommerce) and
    create a real published product with real stock, entirely through the
    normal authenticated warehouse endpoints (stock-ins -> confirm), not a
    direct DB insert."""
    whs = await client.get("/api/v1/warehouse/warehouses")
    assert whs.status_code == 200, whs.text
    warehouse_id = whs.json()[0]["id"]

    setting = await client.put(
        "/api/v1/settings/key/ecommerce",
        json={"value": {"online_warehouse_id": warehouse_id}},
    )
    assert setting.status_code == 200, setting.text

    name = f"E2E Storefront Widget {uuid.uuid4().hex[:8]}"
    prod = await client.post(
        "/api/v1/warehouse/products",
        json={"name": name, "sale_price": "15000", "is_published_online": True},
    )
    assert prod.status_code == 201, prod.text
    product_id = prod.json()["id"]

    stock_in = await client.post(
        "/api/v1/warehouse/stock-ins",
        json={
            "warehouse_id": warehouse_id,
            "items": [{"product_id": product_id, "quantity": qty, "unit_cost": "5000"}],
        },
    )
    assert stock_in.status_code == 201, stock_in.text
    confirm = await client.post(f"/api/v1/warehouse/stock-ins/{stock_in.json()['id']}/confirm")
    assert confirm.status_code == 200, confirm.text

    return {"warehouse_id": warehouse_id, "product_id": product_id, "product_name": name}


async def test_checkout_full_chain_real_e2e(client, org_id):
    """Real HTTP chain, no mocks: configure online warehouse -> publish a
    product with real stock -> anonymous catalog browse (categories,
    products, product detail) -> anonymous checkout -> verify the sale
    really landed (sales/sale_items via /sale/sales/{id}, stock_balances
    decreased via /warehouse/stock) -> anonymous GET /shop/order/{sale_id}
    reflects it."""
    shop = await _setup_published_product_with_stock(client, qty="10")
    org_code = await _org_code(client, org_id)
    guest_phone = _rand_phone()

    async with httpx.AsyncClient(base_url=API_URL, timeout=20) as anon:
        categories = await anon.get("/api/v1/shop/categories", params={"org_code": org_code})
        assert categories.status_code == 200, categories.text
        assert "items" in categories.json()

        products = await anon.get("/api/v1/shop/products", params={"org_code": org_code})
        assert products.status_code == 200, products.text
        products_body = products.json()
        assert products_body["configured"] is True
        listed = {item["id"]: item for item in products_body["items"]}
        assert shop["product_id"] in listed
        assert listed[shop["product_id"]]["stock_status"] == "in_stock"

        detail = await anon.get(
            f"/api/v1/shop/products/{shop['product_id']}", params={"org_code": org_code},
        )
        assert detail.status_code == 200, detail.text
        detail_body = detail.json()
        assert detail_body["name"] == shop["product_name"]
        for forbidden in ("purchase_price", "avg_cost", "cost"):
            assert forbidden not in detail_body

        checkout = await anon.post(
            "/api/v1/shop/checkout",
            json={
                "org_code": org_code,
                "customer": {"name": "E2E Guest Buyer", "phone": guest_phone},
                "items": [{"product_id": shop["product_id"], "quantity": 2}],
                "notes": "E2E real checkout test",
            },
        )
        assert checkout.status_code == 201, checkout.text
        checkout_body = checkout.json()
        assert checkout_body["status"] == "payment_pending"
        assert checkout_body["total_amount"] == 30000.0
        sale_id = checkout_body["sale_id"]

        order = await anon.get(f"/api/v1/shop/order/{sale_id}", params={"org_code": org_code})
        assert order.status_code == 200, order.text
        order_body = order.json()
        assert order_body["sale_id"] == sale_id
        assert order_body["order_number"] == checkout_body["order_number"]
        assert order_body["total_amount"] == 30000.0

    sale = await client.get(f"/api/v1/sale/sales/{sale_id}")
    assert sale.status_code == 200, sale.text
    sale_body = sale.json()
    head = sale_body["head"]
    assert head["status"] == "confirmed"
    assert float(head["total_amount"]) == 30000.0
    assert head["customer_name"] == "E2E Guest Buyer"
    items = sale_body["items"]
    assert len(items) == 1
    assert items[0]["product_id"] == shop["product_id"]
    assert float(items[0]["quantity"]) == 2.0

    balances = await client.get(
        "/api/v1/warehouse/stock", params={"warehouse_id": shop["warehouse_id"]},
    )
    assert balances.status_code == 200, balances.text
    row = next(b for b in balances.json() if b["product_id"] == shop["product_id"])
    assert float(row["quantity"]) == 8.0  # 10 stocked in - 2 sold


async def test_checkout_concurrent_last_unit_real_e2e(client, org_id):
    """DESIGN (d): two real, near-simultaneous checkouts racing for the LAST
    unit of stock. `_stock_apply`'s `SELECT ... FOR UPDATE` on the existing
    stock_balances row must serialize the two live HTTP requests so only one
    commits a sale; the other gets 422 "Insufficient stock" — never a
    double-sell. This was previously only verified manually in a disposable
    script; this is the committed, repeatable version."""
    shop = await _setup_published_product_with_stock(client, qty="1")
    org_code = await _org_code(client, org_id)

    def _checkout_body(phone: str) -> dict:
        return {
            "org_code": org_code,
            "customer": {"name": "Race Buyer", "phone": phone},
            "items": [{"product_id": shop["product_id"], "quantity": 1}],
            "notes": None,
        }

    async with httpx.AsyncClient(base_url=API_URL, timeout=20) as a, \
            httpx.AsyncClient(base_url=API_URL, timeout=20) as b:
        r1, r2 = await asyncio.gather(
            a.post("/api/v1/shop/checkout", json=_checkout_body(_rand_phone())),
            b.post("/api/v1/shop/checkout", json=_checkout_body(_rand_phone())),
        )

    statuses = sorted([r1.status_code, r2.status_code])
    assert statuses == [201, 422], (r1.text, r2.text)
    loser = r1 if r1.status_code == 422 else r2
    assert "Insufficient stock" in loser.json()["detail"]

    balances = await client.get(
        "/api/v1/warehouse/stock", params={"warehouse_id": shop["warehouse_id"]},
    )
    assert balances.status_code == 200, balances.text
    row = next(b for b in balances.json() if b["product_id"] == shop["product_id"])
    assert float(row["quantity"]) == 0.0
