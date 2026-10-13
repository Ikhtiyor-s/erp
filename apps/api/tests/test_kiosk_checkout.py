"""SC-3 — kiosk catalog + checkout flow
(tickets/SC-3-kiosk-checkout-flow.md, tickets/SPEC-self-checkout.md).

Device/cashbox/product setup goes through the real HTTP API using the
shared session admin (conftest.py's `client`/`org_id` fixtures). The
kiosk-token calls under test use a bare httpx client with no staff auth
headers at all — exactly how a real kiosk device calls `/api/v1/kiosk/*`.

Click/Payme are wiped from app_settings before/after every test by
conftest.py's autouse `_clean_integrations` fixture, so every test in this
file runs against "today's real state" (Scenario 5): both providers
disabled, `payment.mode` always comes back "unavailable".

Run inside the container:
    docker exec erp-api python -m pytest tests/test_kiosk_checkout.py -v
"""
import random
import uuid

import asyncpg
import httpx
import pytest

API_URL = "http://localhost:8000"
_PG_DSN = "postgresql://erp:erp@erp-postgres:5432/erp"


def _rand_phone() -> str:
    return "+998" + "".join(str(random.randint(0, 9)) for _ in range(9))


# ---------------------------------------------------------------------------
# Setup helpers (real HTTP calls through the authenticated `client` fixture)
# ---------------------------------------------------------------------------

async def _first_currency_id(client: httpx.AsyncClient) -> int:
    res = await client.get("/api/v1/reference/currencies")
    assert res.status_code == 200, res.text
    return res.json()[0]["id"]


async def _first_warehouse_id(client: httpx.AsyncClient) -> int:
    res = await client.get("/api/v1/warehouse/warehouses")
    assert res.status_code == 200, res.text
    return res.json()[0]["id"]


async def _unit_id_by_short_name(client: httpx.AsyncClient, short_name: str) -> int | None:
    res = await client.get("/api/v1/reference/units")
    assert res.status_code == 200, res.text
    for u in res.json():
        if u["short_name"] == short_name:
            return u["id"]
    return None


async def _create_cashbox(client: httpx.AsyncClient, warehouse_id: int | None = None) -> int:
    currency_id = await _first_currency_id(client)
    if warehouse_id is None:
        warehouse_id = await _first_warehouse_id(client)
    res = await client.post(
        "/api/v1/finance/cashboxes",
        json={
            "name": f"Kiosk Checkout Test Cashbox {uuid.uuid4().hex[:8]}",
            "currency_id": currency_id,
            "warehouse_id": warehouse_id,
        },
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


async def _create_kiosk_device(client: httpx.AsyncClient, cashbox_id: int) -> dict:
    res = await client.post(
        "/api/v1/kiosk-devices",
        json={"name": f"Kiosk Checkout Test Device {uuid.uuid4().hex[:8]}", "cashbox_id": cashbox_id},
    )
    assert res.status_code == 201, res.text
    return res.json()


async def _create_product_with_stock(
    client: httpx.AsyncClient,
    warehouse_id: int,
    *,
    sale_price: str = "15000",
    qty: str = "10",
    unit_id: int | None = None,
    barcode: str | None = None,
) -> dict:
    name = f"Kiosk Test Widget {uuid.uuid4().hex[:8]}"
    barcode = barcode or ("K" + uuid.uuid4().hex[:12])
    payload = {"name": name, "sale_price": sale_price, "barcode": barcode}
    if unit_id is not None:
        payload["unit_id"] = unit_id
    prod = await client.post("/api/v1/warehouse/products", json=payload)
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

    return {"product_id": product_id, "barcode": barcode, "name": name}


async def _set_max_cart_amount(client: httpx.AsyncClient, amount) -> None:
    res = await client.put("/api/v1/settings/key/kiosk", json={"value": {"max_cart_amount": amount}})
    assert res.status_code == 200, res.text


def _kiosk_client(token: str) -> httpx.AsyncClient:
    """Bare client — no Authorization baked in except the device token, and
    no X-Organization-Id at all, exactly like a real kiosk device."""
    return httpx.AsyncClient(
        base_url=API_URL, timeout=10, headers={"Authorization": f"Bearer {token}"},
    )


async def _db_fetchrow(query: str, *args):
    conn = await asyncpg.connect(_PG_DSN)
    try:
        return await conn.fetchrow(query, *args)
    finally:
        await conn.close()


async def _db_fetchval(query: str, *args):
    conn = await asyncpg.connect(_PG_DSN)
    try:
        return await conn.fetchval(query, *args)
    finally:
        await conn.close()


async def _db_execute(query: str, *args):
    conn = await asyncpg.connect(_PG_DSN)
    try:
        await conn.execute(query, *args)
    finally:
        await conn.close()


# ---------------------------------------------------------------------------
# Catalog (Scenario 4)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_catalog_excludes_weight_sold_products_and_reads_device_warehouse_stock(client, org_id):
    warehouse_id = await _first_warehouse_id(client)
    cashbox_id = await _create_cashbox(client, warehouse_id)
    device = await _create_kiosk_device(client, cashbox_id)

    kg_unit_id = await _unit_id_by_short_name(client, "kg")
    assert kg_unit_id is not None, "seed data must include a 'kg' unit"

    pcs_product = await _create_product_with_stock(client, warehouse_id, sale_price="12000", qty="7")
    kg_product = await _create_product_with_stock(
        client, warehouse_id, sale_price="30000", qty="5", unit_id=kg_unit_id,
    )

    async with _kiosk_client(device["token"]) as kc:
        catalog = await kc.get("/api/v1/kiosk/catalog")
        assert catalog.status_code == 200, catalog.text
        items = {item["id"]: item for item in catalog.json()["items"]}
        assert pcs_product["product_id"] in items
        assert kg_product["product_id"] not in items, (
            "weight-sold (kg) product must never appear in the kiosk catalog (Scenario 4)"
        )
        found = items[pcs_product["product_id"]]
        assert found["price"] == 12000.0
        assert found["stock_qty"] == 7.0

        by_barcode = await kc.get(f"/api/v1/kiosk/catalog/{pcs_product['barcode']}")
        assert by_barcode.status_code == 200, by_barcode.text
        assert by_barcode.json()["id"] == pcs_product["product_id"]

        kg_by_barcode = await kc.get(f"/api/v1/kiosk/catalog/{kg_product['barcode']}")
        assert kg_by_barcode.status_code == 404, (
            "a kg product's own barcode must 404 exactly like an unknown barcode (Scenario 4)"
        )

        unknown = await kc.get(f"/api/v1/kiosk/catalog/{uuid.uuid4().hex}")
        assert unknown.status_code == 404
        assert unknown.json()["detail"] == kg_by_barcode.json()["detail"]


# ---------------------------------------------------------------------------
# Checkout happy path (Scenario 1, 5) + source_type tagging + audit log
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_checkout_happy_path_real_sale_source_tagged_payment_unavailable(client, org_id):
    warehouse_id = await _first_warehouse_id(client)
    cashbox_id = await _create_cashbox(client, warehouse_id)
    device = await _create_kiosk_device(client, cashbox_id)
    product = await _create_product_with_stock(client, warehouse_id, sale_price="20000", qty="10")

    async with _kiosk_client(device["token"]) as kc:
        checkout = await kc.post(
            "/api/v1/kiosk/checkout",
            json={"items": [{"product_id": product["product_id"], "quantity": 3}]},
        )
    assert checkout.status_code == 201, checkout.text
    body = checkout.json()
    assert body["status"] == "awaiting_payment"
    assert body["total_amount"] == 60000.0
    assert body["payment"] == {"mode": "unavailable", "provider": None, "payment_url": None}
    sale_id = body["sale_id"]

    # create_sale_core() really ran: real sale row, confirmed (not paid yet).
    sale = await client.get(f"/api/v1/sale/sales/{sale_id}")
    assert sale.status_code == 200, sale.text
    assert sale.json()["head"]["status"] == "confirmed"

    # source_type='sale_kiosk' landed on the stock movement (SPEC MUST).
    movement_source = await _db_fetchval(
        "SELECT source_type FROM stock_movements WHERE source_id = $1 LIMIT 1", sale_id,
    )
    assert movement_source == "sale_kiosk"

    # Full item-level audit_log entry, user_id NULL.
    audit_row = await _db_fetchrow(
        "SELECT user_id, diff FROM audit_log WHERE entity = 'kiosk_orders' AND entity_id = $1", sale_id,
    )
    assert audit_row is not None
    assert audit_row["user_id"] is None
    import json as _json
    diff = _json.loads(audit_row["diff"]) if isinstance(audit_row["diff"], str) else audit_row["diff"]
    assert diff["items"][0]["product_id"] == product["product_id"]
    assert float(diff["items"][0]["quantity"]) == 3.0
    assert diff["device_id"] == device["id"]

    # Stock was really deducted from the device's own warehouse.
    balances = await client.get("/api/v1/warehouse/stock", params={"warehouse_id": warehouse_id})
    row = next(b for b in balances.json() if b["product_id"] == product["product_id"])
    assert float(row["quantity"]) == 7.0  # 10 stocked - 3 sold

    # Poll immediately: still awaiting_payment, not auto-confirmed.
    async with _kiosk_client(device["token"]) as kc:
        poll = await kc.get(f"/api/v1/kiosk/order/{sale_id}")
    assert poll.status_code == 200, poll.text
    assert poll.json()["status"] == "awaiting_payment"


@pytest.mark.asyncio
async def test_checkout_ignores_client_sent_price(client, org_id):
    """Scenario 6 — client adds `price` via devtools; server recomputes from
    products.sale_price regardless, request still succeeds (price is
    ignored, not rejected)."""
    warehouse_id = await _first_warehouse_id(client)
    cashbox_id = await _create_cashbox(client, warehouse_id)
    device = await _create_kiosk_device(client, cashbox_id)
    product = await _create_product_with_stock(client, warehouse_id, sale_price="10000", qty="5")

    async with _kiosk_client(device["token"]) as kc:
        checkout = await kc.post(
            "/api/v1/kiosk/checkout",
            json={"items": [{"product_id": product["product_id"], "quantity": 2, "price": 1}]},
        )
    assert checkout.status_code == 201, checkout.text
    # 2 * 10000 (server price), NOT 2 * 1 (client-tampered price).
    assert checkout.json()["total_amount"] == 20000.0


@pytest.mark.asyncio
async def test_checkout_rejects_weight_sold_product_even_with_known_product_id(client, org_id):
    """A client that somehow learned a kg-product's product_id (it never
    appears in the catalog response) still cannot buy it via checkout."""
    warehouse_id = await _first_warehouse_id(client)
    cashbox_id = await _create_cashbox(client, warehouse_id)
    device = await _create_kiosk_device(client, cashbox_id)
    kg_unit_id = await _unit_id_by_short_name(client, "kg")
    kg_product = await _create_product_with_stock(
        client, warehouse_id, sale_price="30000", qty="5", unit_id=kg_unit_id,
    )

    async with _kiosk_client(device["token"]) as kc:
        checkout = await kc.post(
            "/api/v1/kiosk/checkout",
            json={"items": [{"product_id": kg_product["product_id"], "quantity": 1}]},
        )
    assert checkout.status_code == 422, checkout.text


# ---------------------------------------------------------------------------
# Cart limit (Scenario 2) — MUST run before create_sale_core()
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_checkout_cart_limit_exceeded_blocks_before_any_sale_or_stock_touched(client, org_id):
    warehouse_id = await _first_warehouse_id(client)
    cashbox_id = await _create_cashbox(client, warehouse_id)
    device = await _create_kiosk_device(client, cashbox_id)
    product = await _create_product_with_stock(client, warehouse_id, sale_price="500000", qty="10")

    await _set_max_cart_amount(client, 100000)

    sales_before = await _db_fetchval("SELECT COUNT(*) FROM sales")

    async with _kiosk_client(device["token"]) as kc:
        checkout = await kc.post(
            "/api/v1/kiosk/checkout",
            json={"items": [{"product_id": product["product_id"], "quantity": 1}]},
        )
    assert checkout.status_code == 422, checkout.text
    assert checkout.json()["detail"]["code"] == "cart_limit_exceeded"

    sales_after = await _db_fetchval("SELECT COUNT(*) FROM sales")
    assert sales_after == sales_before, "no sale row must be created when the cart limit is exceeded"

    balances = await client.get("/api/v1/warehouse/stock", params={"warehouse_id": warehouse_id})
    row = next(b for b in balances.json() if b["product_id"] == product["product_id"])
    assert float(row["quantity"]) == 10.0, "stock must be untouched when the cart limit is exceeded"


@pytest.mark.asyncio
async def test_checkout_within_cart_limit_still_succeeds(client, org_id):
    warehouse_id = await _first_warehouse_id(client)
    cashbox_id = await _create_cashbox(client, warehouse_id)
    device = await _create_kiosk_device(client, cashbox_id)
    product = await _create_product_with_stock(client, warehouse_id, sale_price="1000", qty="10")

    await _set_max_cart_amount(client, 100000)

    async with _kiosk_client(device["token"]) as kc:
        checkout = await kc.post(
            "/api/v1/kiosk/checkout",
            json={"items": [{"product_id": product["product_id"], "quantity": 2}]},
        )
    assert checkout.status_code == 201, checkout.text


# ---------------------------------------------------------------------------
# Idempotency (SPEC MUST)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_checkout_idempotency_key_double_submit_creates_one_sale(client, org_id):
    warehouse_id = await _first_warehouse_id(client)
    cashbox_id = await _create_cashbox(client, warehouse_id)
    device = await _create_kiosk_device(client, cashbox_id)
    product = await _create_product_with_stock(client, warehouse_id, sale_price="5000", qty="10")

    ikey = f"kiosk-test-{uuid.uuid4().hex}"
    body = {"items": [{"product_id": product["product_id"], "quantity": 1}]}

    async with _kiosk_client(device["token"]) as kc:
        first = await kc.post("/api/v1/kiosk/checkout", json=body, headers={"Idempotency-Key": ikey})
        assert first.status_code == 201, first.text
        second = await kc.post("/api/v1/kiosk/checkout", json=body, headers={"Idempotency-Key": ikey})
        assert second.status_code == 201, second.text

    assert first.json()["sale_id"] == second.json()["sale_id"]
    assert second.headers.get("X-Idempotency-Replayed") == "true"

    sale_count = await _db_fetchval(
        "SELECT COUNT(*) FROM kiosk_orders WHERE sale_id = $1", first.json()["sale_id"],
    )
    assert sale_count == 1


# ---------------------------------------------------------------------------
# Cross-tenant isolation (Scenario 7)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_order_status_cross_tenant_isolation(client, org_id):
    warehouse_id = await _first_warehouse_id(client)
    cashbox_id = await _create_cashbox(client, warehouse_id)
    device_a = await _create_kiosk_device(client, cashbox_id)
    product = await _create_product_with_stock(client, warehouse_id, sale_price="7000", qty="10")

    async with _kiosk_client(device_a["token"]) as kc:
        checkout = await kc.post(
            "/api/v1/kiosk/checkout",
            json={"items": [{"product_id": product["product_id"], "quantity": 1}]},
        )
    assert checkout.status_code == 201, checkout.text
    sale_id = checkout.json()["sale_id"]

    # Org B: fresh org, its own cashbox + kiosk device.
    phone = _rand_phone()
    async with httpx.AsyncClient(base_url=API_URL, timeout=10) as c:
        otp = await c.post("/api/v1/auth/register/request-otp", json={"phone": phone})
        assert otp.status_code == 200, otp.text
        dev_code = otp.json()["dev_code"]
        verify = await c.post("/api/v1/auth/register/verify-otp", json={"phone": phone, "code": dev_code})
        assert verify.status_code == 200, verify.text
        ticket = verify.json()["ticket"]
        reg = await c.post(
            "/api/v1/auth/register",
            json={
                "ticket": ticket, "phone": phone, "password": "TestPass123!",
                "full_name": "Org B Admin", "organization_name": f"Org B {uuid.uuid4().hex[:8]}",
            },
        )
        assert reg.status_code == 201, reg.text
        token_b = reg.json()["access_token"]
        orgs = await c.get("/api/v1/organizations/mine", headers={"Authorization": f"Bearer {token_b}"})
        org_b_id = orgs.json()[0]["id"]
        headers_b = {"Authorization": f"Bearer {token_b}", "X-Organization-Id": org_b_id}

        whs_b = await c.get("/api/v1/warehouse/warehouses", headers=headers_b)
        warehouse_b_id = whs_b.json()[0]["id"]
        cur_b = await c.get("/api/v1/reference/currencies", headers=headers_b)
        currency_b_id = cur_b.json()[0]["id"]
        cashbox_b = await c.post(
            "/api/v1/finance/cashboxes",
            headers=headers_b,
            json={"name": "Org B Cashbox", "currency_id": currency_b_id, "warehouse_id": warehouse_b_id},
        )
        assert cashbox_b.status_code == 201, cashbox_b.text
        device_b = await c.post(
            "/api/v1/kiosk-devices", headers=headers_b,
            json={"name": "Org B Kiosk", "cashbox_id": cashbox_b.json()["id"]},
        )
        assert device_b.status_code == 201, device_b.text
        token_b_device = device_b.json()["token"]

    async with _kiosk_client(token_b_device) as kc_b:
        cross = await kc_b.get(f"/api/v1/kiosk/order/{sale_id}")
    assert cross.status_code == 404, cross.text

    # Org A's own device can still see it fine.
    async with _kiosk_client(device_a["token"]) as kc_a:
        own = await kc_a.get(f"/api/v1/kiosk/order/{sale_id}")
    assert own.status_code == 200, own.text


# ---------------------------------------------------------------------------
# The mandatory regression test: no backend timeout ever auto-confirms a
# kiosk sale as paid.
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_unpaid_order_never_auto_confirms_after_timeout(client, org_id):
    """A sale sitting in `awaiting_payment` must NEVER be auto-marked `paid`
    by any backend timeout/cron/logic. The "give up and show a message"
    behavior belongs entirely to the frontend (SC-5); the backend must keep
    returning `awaiting_payment` indefinitely until a real payment webhook
    or a staff member acts."""
    warehouse_id = await _first_warehouse_id(client)
    cashbox_id = await _create_cashbox(client, warehouse_id)
    device = await _create_kiosk_device(client, cashbox_id)
    product = await _create_product_with_stock(client, warehouse_id, sale_price="9000", qty="10")

    async with _kiosk_client(device["token"]) as kc:
        checkout = await kc.post(
            "/api/v1/kiosk/checkout",
            json={"items": [{"product_id": product["product_id"], "quantity": 1}]},
        )
    assert checkout.status_code == 201, checkout.text
    sale_id = checkout.json()["sale_id"]
    assert checkout.json()["status"] == "awaiting_payment"

    # Simulate a very long elapsed wait (far beyond SC-5's ~90s frontend
    # budget) by back-dating the sale itself — if any backend logic keyed
    # off elapsed time existed, this is exactly the condition that would
    # trigger it.
    await _db_execute(
        "UPDATE sales SET sale_date = NOW() - INTERVAL '1 year' WHERE id = $1", sale_id,
    )
    await _db_execute(
        "UPDATE kiosk_orders SET created_at = NOW() - INTERVAL '1 year' WHERE sale_id = $1", sale_id,
    )

    async with _kiosk_client(device["token"]) as kc:
        for _ in range(5):
            poll = await kc.get(f"/api/v1/kiosk/order/{sale_id}")
            assert poll.status_code == 200, poll.text
            assert poll.json()["status"] == "awaiting_payment", (
                "backend must never auto-confirm an unpaid kiosk sale, "
                "regardless of elapsed time"
            )

    # Sanity: the sale really is still just 'confirmed' at the DB level too.
    sale_status = await _db_fetchval("SELECT status FROM sales WHERE id = $1", sale_id)
    assert sale_status == "confirmed"


@pytest.mark.asyncio
async def test_staff_cancel_is_reflected_in_kiosk_order_status(client, org_id):
    """The one legitimate way an awaiting_payment kiosk order resolves
    without a real payment: a staff member manually cancels it via the
    existing POST /sale/sales/{id}/cancel (SPEC "Qoldiq tavakkal")."""
    warehouse_id = await _first_warehouse_id(client)
    cashbox_id = await _create_cashbox(client, warehouse_id)
    device = await _create_kiosk_device(client, cashbox_id)
    product = await _create_product_with_stock(client, warehouse_id, sale_price="4000", qty="10")

    async with _kiosk_client(device["token"]) as kc:
        checkout = await kc.post(
            "/api/v1/kiosk/checkout",
            json={"items": [{"product_id": product["product_id"], "quantity": 1}]},
        )
    assert checkout.status_code == 201, checkout.text
    sale_id = checkout.json()["sale_id"]

    cancel = await client.post(f"/api/v1/sale/sales/{sale_id}/cancel")
    assert cancel.status_code == 200, cancel.text

    async with _kiosk_client(device["token"]) as kc:
        poll = await kc.get(f"/api/v1/kiosk/order/{sale_id}")
    assert poll.status_code == 200, poll.text
    assert poll.json()["status"] == "cancelled"
