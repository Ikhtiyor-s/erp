"""RG-2 — mixed payment (cash + card split) in one atomic request.

Covers:
- POST /sale/sales/{id}/pay-split writes one cash_movements row per line and
  sums paid_amount correctly in a single atomic commit.
- Over-payment: sum(payments[].amount) > remaining balance -> 422, nothing written.
- Partial failure (one bad cashbox_id) -> whole request rolled back, no partial writes.
- create_sale_core's optional `payments` -- checkout-time payment via POST /sale/sales
  (the mobile POS "payments" array that used to be silently dropped).

Run: docker exec erp-api pytest tests/test_sale_pay_split.py -v
"""
import os

import asyncpg
import httpx
import pytest

pytestmark = pytest.mark.asyncio

_PG_DSN = os.environ.get(
    "DATABASE_URL_SYNC",
    "postgresql://erp:erp@erp-postgres:5432/erp",
)


async def _get_currency_id(client: httpx.AsyncClient) -> int:
    r = await client.get("/api/v1/reference/currencies")
    assert r.status_code == 200
    currencies = r.json()
    assert currencies, "Demo seed must have at least one currency"
    return currencies[0]["id"]


async def _ensure_warehouse(client: httpx.AsyncClient, name: str) -> int:
    r = await client.get("/api/v1/warehouse/warehouses")
    assert r.status_code == 200
    for wh in r.json():
        if wh["name"] == name:
            return wh["id"]
    r = await client.post("/api/v1/warehouse/warehouses", json={"name": name})
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def _ensure_product(client: httpx.AsyncClient, name: str) -> str:
    r = await client.get("/api/v1/warehouse/products", params={"q": name, "limit": 5})
    assert r.status_code == 200
    for p in r.json():
        if p["name"] == name:
            return str(p["id"])
    r = await client.post("/api/v1/warehouse/products",
                          json={"name": name, "purchase_price": "500", "sale_price": "1000"})
    assert r.status_code in (200, 201), f"product create failed: {r.text}"
    return str(r.json()["id"])


async def _ensure_cashbox(client: httpx.AsyncClient, name: str) -> int:
    r = await client.get("/api/v1/finance/cashboxes")
    assert r.status_code == 200
    for cb in r.json():
        if cb["name"] == name:
            return cb["id"]
    cur_id = await _get_currency_id(client)
    r = await client.post("/api/v1/finance/cashboxes", json={"name": name, "currency_id": cur_id})
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def _set_stock(client: httpx.AsyncClient, wh_id: int, product_id: str, qty: str) -> None:
    r = await client.post("/api/v1/warehouse/inventories", json={
        "warehouse_id": wh_id,
        "items": [{"product_id": product_id, "actual_qty": qty}],
    })
    assert r.status_code in (200, 201), f"inventory create: {r.text}"
    iid = r.json()["id"]
    r = await client.post(f"/api/v1/warehouse/inventories/{iid}/finish")
    assert r.status_code == 200, f"inventory finish: {r.text}"


async def _get_payment_type_ids(client: httpx.AsyncClient) -> dict:
    r = await client.get("/api/v1/reference/payment-types")
    assert r.status_code == 200
    return {pt["code"]: pt["id"] for pt in r.json()}


async def _cash_movement_rows_for_sale(sale_id: str) -> list[dict]:
    conn = await asyncpg.connect(_PG_DSN)
    try:
        rows = await conn.fetch(
            "SELECT amount, payment_type_id, cashbox_id, direction "
            "FROM cash_movements WHERE sale_id = $1 ORDER BY id",
            sale_id,
        )
        return [dict(r) for r in rows]
    finally:
        await conn.close()


async def _create_unpaid_sale(client: httpx.AsyncClient, amount: float = 100000) -> tuple[str, int]:
    wh_id = await _ensure_warehouse(client, "RG2-TestWarehouse")
    pid = await _ensure_product(client, "RG2-Product-A")
    cur_id = await _get_currency_id(client)
    await _set_stock(client, wh_id, pid, "1000")
    r = await client.post("/api/v1/sale/sales", json={
        "warehouse_id": wh_id,
        "currency_id": cur_id,
        "items": [{"product_id": pid, "quantity": 1, "price": amount, "discount": 0}],
    })
    assert r.status_code == 201, r.text
    return r.json()["id"], wh_id


# ---------------------------------------------------------------------------
# pay-split: happy path
# ---------------------------------------------------------------------------

async def test_pay_split_writes_two_cash_movement_rows_atomically(client: httpx.AsyncClient):
    sale_id, _ = await _create_unpaid_sale(client, amount=100000)
    cb_id = await _ensure_cashbox(client, "RG2-Cashbox-A")
    pts = await _get_payment_type_ids(client)

    resp = await client.post(f"/api/v1/sale/sales/{sale_id}/pay-split", json={
        "payments": [
            {"payment_type_id": pts.get("cash"), "cashbox_id": cb_id, "amount": 60000},
            {"payment_type_id": pts.get("card"), "cashbox_id": cb_id, "amount": 40000},
        ],
    })
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "paid"
    assert float(body["paid_amount"]) == 100000

    get_resp = await client.get(f"/api/v1/sale/sales/{sale_id}")
    assert get_resp.status_code == 200
    head = get_resp.json()["head"]
    assert float(head["paid_amount"]) == 100000
    assert head["status"] == "paid"

    rows = await _cash_movement_rows_for_sale(sale_id)
    assert len(rows) == 2, f"expected 2 cash_movements rows, got {rows}"
    assert sorted(float(r["amount"]) for r in rows) == [40000.0, 60000.0]
    assert all(r["direction"] == "in" for r in rows)


# ---------------------------------------------------------------------------
# pay-split: over-payment MUST 422, nothing written
# ---------------------------------------------------------------------------

async def test_pay_split_overpayment_returns_422_and_writes_nothing(client: httpx.AsyncClient):
    sale_id, _ = await _create_unpaid_sale(client, amount=50000)
    cb_id = await _ensure_cashbox(client, "RG2-Cashbox-B")

    resp = await client.post(f"/api/v1/sale/sales/{sale_id}/pay-split", json={
        "payments": [
            {"cashbox_id": cb_id, "amount": 30000},
            {"cashbox_id": cb_id, "amount": 30000},  # sum 60000 > remaining 50000
        ],
    })
    assert resp.status_code == 422, resp.text

    get_resp = await client.get(f"/api/v1/sale/sales/{sale_id}")
    head = get_resp.json()["head"]
    assert float(head["paid_amount"]) == 0
    assert head["status"] in ("confirmed", "draft")

    rows = await _cash_movement_rows_for_sale(sale_id)
    assert rows == [], f"over-payment must write nothing, got {rows}"


# ---------------------------------------------------------------------------
# pay-split: one bad line (cross-tenant cashbox_id) MUST roll back everything
# ---------------------------------------------------------------------------

async def test_pay_split_bad_line_rolls_back_whole_request(client: httpx.AsyncClient):
    sale_id, _ = await _create_unpaid_sale(client, amount=70000)
    cb_id = await _ensure_cashbox(client, "RG2-Cashbox-C")

    resp = await client.post(f"/api/v1/sale/sales/{sale_id}/pay-split", json={
        "payments": [
            {"cashbox_id": cb_id, "amount": 40000},
            {"cashbox_id": 999999, "amount": 30000},  # does not belong to this org
        ],
    })
    assert resp.status_code in (400, 422), resp.text

    get_resp = await client.get(f"/api/v1/sale/sales/{sale_id}")
    head = get_resp.json()["head"]
    assert float(head["paid_amount"]) == 0, "partial write leaked: paid_amount changed"

    rows = await _cash_movement_rows_for_sale(sale_id)
    assert rows == [], f"partial failure must write nothing, got {rows}"


async def test_pay_split_requires_nonempty_payments(client: httpx.AsyncClient):
    sale_id, _ = await _create_unpaid_sale(client, amount=10000)
    resp = await client.post(f"/api/v1/sale/sales/{sale_id}/pay-split", json={"payments": []})
    assert resp.status_code == 422, resp.text


# ---------------------------------------------------------------------------
# existing single-payment /pay endpoint must still work unchanged (regression)
# ---------------------------------------------------------------------------

async def test_existing_single_pay_endpoint_unchanged(client: httpx.AsyncClient):
    sale_id, _ = await _create_unpaid_sale(client, amount=20000)
    resp = await client.post(f"/api/v1/sale/sales/{sale_id}/pay", json={"amount": 20000})
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "paid"


# ---------------------------------------------------------------------------
# checkout-time payment: create_sale_core's optional `payments` param
# (closes the mobile POS gap — payments array used to be silently dropped)
# ---------------------------------------------------------------------------

async def test_create_sale_with_checkout_payments_is_already_paid(client: httpx.AsyncClient):
    wh_id = await _ensure_warehouse(client, "RG2-TestWarehouse")
    pid = await _ensure_product(client, "RG2-Product-Checkout")
    cur_id = await _get_currency_id(client)
    await _set_stock(client, wh_id, pid, "1000")
    cb_id = await _ensure_cashbox(client, "RG2-Cashbox-Checkout")
    pts = await _get_payment_type_ids(client)

    resp = await client.post("/api/v1/sale/sales", json={
        "warehouse_id": wh_id,
        "currency_id": cur_id,
        "items": [{"product_id": pid, "quantity": 1, "price": 15000, "discount": 0}],
        "payments": [
            {"payment_type_id": pts.get("cash"), "cashbox_id": cb_id, "amount": 15000},
        ],
    })
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert float(body["paid_amount"]) == 15000
    sale_id = body["id"]

    get_resp = await client.get(f"/api/v1/sale/sales/{sale_id}")
    head = get_resp.json()["head"]
    assert head["status"] == "paid"
    assert float(head["paid_amount"]) == 15000

    rows = await _cash_movement_rows_for_sale(sale_id)
    assert len(rows) == 1
    assert float(rows[0]["amount"]) == 15000


async def test_create_sale_with_mixed_checkout_payments_partial_status(client: httpx.AsyncClient):
    wh_id = await _ensure_warehouse(client, "RG2-TestWarehouse")
    pid = await _ensure_product(client, "RG2-Product-Checkout2")
    cur_id = await _get_currency_id(client)
    await _set_stock(client, wh_id, pid, "1000")
    cb_id = await _ensure_cashbox(client, "RG2-Cashbox-Checkout2")
    pts = await _get_payment_type_ids(client)

    resp = await client.post("/api/v1/sale/sales", json={
        "warehouse_id": wh_id,
        "currency_id": cur_id,
        "items": [{"product_id": pid, "quantity": 1, "price": 30000, "discount": 0}],
        "payments": [
            {"payment_type_id": pts.get("cash"), "cashbox_id": cb_id, "amount": 10000},
            {"payment_type_id": pts.get("card"), "cashbox_id": cb_id, "amount": 10000},
        ],
    })
    assert resp.status_code == 201, resp.text
    sale_id = resp.json()["id"]

    get_resp = await client.get(f"/api/v1/sale/sales/{sale_id}")
    head = get_resp.json()["head"]
    assert head["status"] == "partial"
    assert float(head["paid_amount"]) == 20000

    rows = await _cash_movement_rows_for_sale(sale_id)
    assert len(rows) == 2


async def test_create_sale_checkout_payments_overpayment_422_no_sale_created(client: httpx.AsyncClient):
    wh_id = await _ensure_warehouse(client, "RG2-TestWarehouse")
    pid = await _ensure_product(client, "RG2-Product-Checkout3")
    cur_id = await _get_currency_id(client)
    await _set_stock(client, wh_id, pid, "1000")
    cb_id = await _ensure_cashbox(client, "RG2-Cashbox-Checkout3")

    resp = await client.post("/api/v1/sale/sales", json={
        "warehouse_id": wh_id,
        "currency_id": cur_id,
        "items": [{"product_id": pid, "quantity": 1, "price": 5000, "discount": 0}],
        "payments": [
            {"cashbox_id": cb_id, "amount": 999999},  # far exceeds total_amount
        ],
    })
    assert resp.status_code == 422, resp.text
