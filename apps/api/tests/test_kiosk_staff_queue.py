"""SC-4 — staff queue visibility + abandoned-cart staff-visibility
(tickets/SC-4-kiosk-staff-queue-risk-mitigation.md, tickets/SPEC-self-checkout.md
"Qoldiq tavakkal").

Reuses SC-3's checkout flow (payments disabled -> `awaiting_payment`) to build
the kiosk sale under test, then exercises the EXISTING `GET /sale/sales` list
endpoint (new `source_type` query param + kiosk-aware `status` translation)
and the EXISTING `POST /sale/sales/{id}/cancel` endpoint -- no new endpoints
are introduced by this ticket.

Run inside the container:
    docker exec erp-api python -m pytest tests/test_kiosk_staff_queue.py -v
"""
import uuid

import asyncpg
import httpx
import pytest

API_URL = "http://localhost:8000"
_PG_DSN = "postgresql://erp:erp@erp-postgres:5432/erp"


# ---------------------------------------------------------------------------
# Setup helpers (same pattern as test_kiosk_checkout.py -- each kiosk test
# file duplicates these rather than importing across test files, matching
# this repo's existing convention).
# ---------------------------------------------------------------------------

async def _first_currency_id(client: httpx.AsyncClient) -> int:
    res = await client.get("/api/v1/reference/currencies")
    assert res.status_code == 200, res.text
    return res.json()[0]["id"]


async def _first_warehouse_id(client: httpx.AsyncClient) -> int:
    res = await client.get("/api/v1/warehouse/warehouses")
    assert res.status_code == 200, res.text
    return res.json()[0]["id"]


async def _create_cashbox(client: httpx.AsyncClient, warehouse_id: int) -> int:
    currency_id = await _first_currency_id(client)
    res = await client.post(
        "/api/v1/finance/cashboxes",
        json={
            "name": f"SC-4 Staff Queue Test Cashbox {uuid.uuid4().hex[:8]}",
            "currency_id": currency_id,
            "warehouse_id": warehouse_id,
        },
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


async def _create_kiosk_device(client: httpx.AsyncClient, cashbox_id: int) -> dict:
    res = await client.post(
        "/api/v1/kiosk-devices",
        json={"name": f"SC-4 Staff Queue Test Device {uuid.uuid4().hex[:8]}", "cashbox_id": cashbox_id},
    )
    assert res.status_code == 201, res.text
    return res.json()


async def _create_product_with_stock(
    client: httpx.AsyncClient, warehouse_id: int, *, sale_price: str = "15000", qty: str = "10",
) -> dict:
    name = f"SC-4 Test Widget {uuid.uuid4().hex[:8]}"
    barcode = "K" + uuid.uuid4().hex[:12]
    prod = await client.post(
        "/api/v1/warehouse/products", json={"name": name, "sale_price": sale_price, "barcode": barcode},
    )
    assert prod.status_code == 201, prod.text
    product_id = prod.json()["id"]

    stock_in = await client.post(
        "/api/v1/warehouse/stock-ins",
        json={"warehouse_id": warehouse_id, "items": [{"product_id": product_id, "quantity": qty, "unit_cost": "5000"}]},
    )
    assert stock_in.status_code == 201, stock_in.text
    confirm = await client.post(f"/api/v1/warehouse/stock-ins/{stock_in.json()['id']}/confirm")
    assert confirm.status_code == 200, confirm.text
    return {"product_id": product_id, "name": name}


async def _stock_qty(client: httpx.AsyncClient, warehouse_id: int, product_id: str) -> float:
    balances = await client.get("/api/v1/warehouse/stock", params={"warehouse_id": warehouse_id})
    assert balances.status_code == 200, balances.text
    row = next(b for b in balances.json() if b["product_id"] == product_id)
    return float(row["quantity"])


def _kiosk_client(token: str) -> httpx.AsyncClient:
    return httpx.AsyncClient(base_url=API_URL, timeout=10, headers={"Authorization": f"Bearer {token}"})


async def _kiosk_checkout(device_token: str, product_id: str, quantity: int = 1) -> dict:
    async with _kiosk_client(device_token) as kc:
        res = await kc.post(
            "/api/v1/kiosk/checkout", json={"items": [{"product_id": product_id, "quantity": quantity}]},
        )
    assert res.status_code == 201, res.text
    return res.json()


async def _create_staff_sale(
    client: httpx.AsyncClient, warehouse_id: int, currency_id: int, product_id: str,
) -> str:
    """A plain staff-POS sale -- the "not kiosk" comparison point for the
    source_type filter/badge."""
    res = await client.post(
        "/api/v1/sale/sales",
        json={
            "warehouse_id": warehouse_id, "currency_id": currency_id,
            "items": [{"product_id": product_id, "quantity": 1, "price": 1000}],
        },
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


async def _set_kiosk_settings(client: httpx.AsyncClient, **value) -> None:
    res = await client.put("/api/v1/settings/key/kiosk", json={"value": value})
    assert res.status_code == 200, res.text


async def _list_sales(client: httpx.AsyncClient, **params) -> list[dict]:
    res = await client.get("/api/v1/sale/sales", params=params)
    assert res.status_code == 200, res.text
    return res.json()


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
# Staff queue visibility -- GET /sale/sales?source_type=sale_kiosk&status=awaiting_payment
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_awaiting_payment_kiosk_sale_appears_in_filtered_staff_queue_with_source_badge(client, org_id):
    warehouse_id = await _first_warehouse_id(client)
    currency_id = await _first_currency_id(client)
    cashbox_id = await _create_cashbox(client, warehouse_id)
    device = await _create_kiosk_device(client, cashbox_id)
    product = await _create_product_with_stock(client, warehouse_id, sale_price="20000", qty="10")

    checkout = await _kiosk_checkout(device["token"], product["product_id"], quantity=1)
    sale_id = checkout["sale_id"]
    assert checkout["status"] == "awaiting_payment"

    # A plain staff-POS sale for the same org -- must NOT show up under the
    # kiosk filter, and must be badged source_type='sale' when listed.
    staff_product = await _create_product_with_stock(client, warehouse_id, sale_price="1000", qty="5")
    staff_sale_id = await _create_staff_sale(client, warehouse_id, currency_id, staff_product["product_id"])

    queue = await _list_sales(client, source_type="sale_kiosk", status="awaiting_payment")
    queue_ids = {r["id"] for r in queue}
    assert sale_id in queue_ids, "kiosk sale stuck in awaiting_payment must appear in the filtered staff queue"
    assert staff_sale_id not in queue_ids, "a staff-POS sale must never appear in the kiosk-only filter"

    row = next(r for r in queue if r["id"] == sale_id)
    assert row["source_type"] == "sale_kiosk"
    assert row["kiosk_device_name"] == device["name"], "staff must see which device the sale came from at a glance"
    assert row["kiosk_order_number"] == checkout["order_number"]
    assert row["kiosk_status"] == "awaiting_payment"
    assert row["is_stale"] is False

    # Same endpoint, no kiosk filter -- the staff sale is still visible and
    # correctly badged as non-kiosk (source_type distinguishes it, status
    # filtering/RBAC otherwise unaffected -- this is a filter, not a new surface).
    unfiltered = await _list_sales(client, source_type="sale")
    unfiltered_row = next(r for r in unfiltered if r["id"] == staff_sale_id)
    assert unfiltered_row["source_type"] == "sale"
    assert unfiltered_row["kiosk_device_name"] is None
    assert sale_id not in {r["id"] for r in unfiltered}


# ---------------------------------------------------------------------------
# Cancel restores stock to the correct warehouse (Acceptance Criteria #3/#4)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_cancel_kiosk_sale_restores_stock_to_the_device_warehouse_and_leaves_awaiting_queue(client, org_id):
    warehouse_id = await _first_warehouse_id(client)
    cashbox_id = await _create_cashbox(client, warehouse_id)
    device = await _create_kiosk_device(client, cashbox_id)
    product = await _create_product_with_stock(client, warehouse_id, sale_price="9000", qty="10")

    before_qty = await _stock_qty(client, warehouse_id, product["product_id"])
    assert before_qty == 10.0

    checkout = await _kiosk_checkout(device["token"], product["product_id"], quantity=4)
    sale_id = checkout["sale_id"]

    after_checkout_qty = await _stock_qty(client, warehouse_id, product["product_id"])
    assert after_checkout_qty == 6.0, "checkout must really deduct stock from the device's warehouse"

    queue_before = await _list_sales(client, source_type="sale_kiosk", status="awaiting_payment")
    assert sale_id in {r["id"] for r in queue_before}

    cancel = await client.post(f"/api/v1/sale/sales/{sale_id}/cancel")
    assert cancel.status_code == 200, cancel.text

    after_cancel_qty = await _stock_qty(client, warehouse_id, product["product_id"])
    assert after_cancel_qty == 10.0, (
        "cancelling a stuck kiosk sale must restore stock to exactly the warehouse "
        "it was deducted from -- same path as a staff-POS cancel"
    )

    # Live-computed, not cache-dependent: the staff queue reflects 'cancelled'
    # immediately, without requiring the kiosk to poll GET /kiosk/order first.
    queue_after = await _list_sales(client, source_type="sale_kiosk", status="awaiting_payment")
    assert sale_id not in {r["id"] for r in queue_after}, "a cancelled kiosk sale must drop out of the awaiting-payment queue"

    cancelled_view = await _list_sales(client, source_type="sale_kiosk", status="cancelled")
    cancelled_row = next(r for r in cancelled_view if r["id"] == sale_id)
    assert cancelled_row["kiosk_status"] == "cancelled"
    assert cancelled_row["is_stale"] is False


# ---------------------------------------------------------------------------
# Abandoned-cart staff-visibility: idle flagging, live-computed, NEVER auto-cancel
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_idle_kiosk_sale_is_flagged_stale_but_never_auto_cancelled(client, org_id):
    warehouse_id = await _first_warehouse_id(client)
    cashbox_id = await _create_cashbox(client, warehouse_id)
    device = await _create_kiosk_device(client, cashbox_id)
    product = await _create_product_with_stock(client, warehouse_id, sale_price="5000", qty="20")

    await _set_kiosk_settings(client, cart_idle_timeout_min=1)
    try:
        fresh = await _kiosk_checkout(device["token"], product["product_id"], quantity=1)
        old = await _kiosk_checkout(device["token"], product["product_id"], quantity=1)

        # Back-date only the old order's kiosk_orders.created_at well past the
        # 1-minute threshold -- mirrors test_kiosk_checkout.py's back-dating
        # technique for its own "never auto-confirms" test.
        await _db_execute(
            "UPDATE kiosk_orders SET created_at = NOW() - INTERVAL '10 minutes' WHERE sale_id = $1",
            old["sale_id"],
        )

        queue = await _list_sales(client, source_type="sale_kiosk", status="awaiting_payment")
        by_id = {r["id"]: r for r in queue}
        assert by_id[old["sale_id"]]["is_stale"] is True, "idle past the configured threshold must flag the sale as stale"
        assert by_id[fresh["sale_id"]]["is_stale"] is False, "a freshly-created sale must not be flagged stale"

        # Flagged-to-the-top sort: the stale sale must rank before the fresh
        # one in the default ordering.
        ids_in_order = [r["id"] for r in queue]
        assert ids_in_order.index(old["sale_id"]) < ids_in_order.index(fresh["sale_id"])

        # The hard constraint: staleness is visibility-only. No auto-cancel,
        # no stock restore, status stays exactly 'awaiting_payment'.
        assert by_id[old["sale_id"]]["kiosk_status"] == "awaiting_payment"
        db_status = await _db_fetchval("SELECT status FROM sales WHERE id = $1", old["sale_id"])
        assert db_status == "confirmed", "a stale kiosk sale must never be auto-cancelled by the staleness check"

        qty_after = await _stock_qty(client, warehouse_id, product["product_id"])
        assert qty_after == 18.0, "stock must be untouched by the staleness check (20 - 1 - 1, no auto-restore)"

        # Independent confirmation via the kiosk's own polling endpoint
        # (SC-3) -- still awaiting_payment, never auto-resolved.
        async with _kiosk_client(device["token"]) as kc:
            poll = await kc.get(f"/api/v1/kiosk/order/{old['sale_id']}")
        assert poll.status_code == 200, poll.text
        assert poll.json()["status"] == "awaiting_payment"
    finally:
        await _set_kiosk_settings(client, cart_idle_timeout_min=3)


@pytest.mark.asyncio
async def test_idle_threshold_is_configurable_per_org(client, org_id):
    """Same elapsed time, two different configured thresholds -> different
    is_stale outcome. Proves the threshold is actually read from
    app_settings['kiosk'].cart_idle_timeout_min, not hardcoded."""
    warehouse_id = await _first_warehouse_id(client)
    cashbox_id = await _create_cashbox(client, warehouse_id)
    device = await _create_kiosk_device(client, cashbox_id)
    product = await _create_product_with_stock(client, warehouse_id, sale_price="3000", qty="10")

    order = await _kiosk_checkout(device["token"], product["product_id"], quantity=1)
    await _db_execute(
        "UPDATE kiosk_orders SET created_at = NOW() - INTERVAL '2 minutes' WHERE sale_id = $1",
        order["sale_id"],
    )

    try:
        await _set_kiosk_settings(client, cart_idle_timeout_min=10)
        not_yet_stale = await _list_sales(client, source_type="sale_kiosk", status="awaiting_payment")
        row = next(r for r in not_yet_stale if r["id"] == order["sale_id"])
        assert row["is_stale"] is False, "2 minutes elapsed must not be stale against a 10-minute threshold"

        await _set_kiosk_settings(client, cart_idle_timeout_min=1)
        now_stale = await _list_sales(client, source_type="sale_kiosk", status="awaiting_payment")
        row2 = next(r for r in now_stale if r["id"] == order["sale_id"])
        assert row2["is_stale"] is True, "2 minutes elapsed must be stale against a 1-minute threshold"
    finally:
        await _set_kiosk_settings(client, cart_idle_timeout_min=3)
