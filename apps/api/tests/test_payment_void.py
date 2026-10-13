"""REGOS-parity payment-line storno — docs/regos-pos/operations/
sales-registration/payment-by-document.md.

Covers:
- POST /sale/sales/{id}/pay/{movement_id}/void reverses a single cash-backed
  payment line without deleting it (voided_at set, compensating negative row
  inserted, both audit-visible).
- paid_amount/status correctly recomputed after a void.
- Double-void of the same movement -> 409.
- Voiding once the sale has reached 'paid' -> 409 (loyalty earn-on-pay guard).
- Voiding a movement that belongs to another sale -> 404.

Run: docker exec erp-api pytest tests/test_payment_void.py -v
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


async def _create_unpaid_sale(client: httpx.AsyncClient, name_suffix: str, amount: float) -> tuple[str, int]:
    wh_id = await _ensure_warehouse(client, "PayVoid-TestWarehouse")
    pid = await _ensure_product(client, f"PayVoid-Product-{name_suffix}")
    cur_id = await _get_currency_id(client)
    await _set_stock(client, wh_id, pid, "1000")
    r = await client.post("/api/v1/sale/sales", json={
        "warehouse_id": wh_id,
        "currency_id": cur_id,
        "items": [{"product_id": pid, "quantity": 1, "price": amount, "discount": 0}],
    })
    assert r.status_code == 201, r.text
    return r.json()["id"], wh_id


async def _movement_row(movement_id: int) -> dict:
    conn = await asyncpg.connect(_PG_DSN)
    try:
        row = await conn.fetchrow(
            "SELECT amount, direction, voided_at, void_of_id FROM cash_movements WHERE id = $1",
            movement_id,
        )
        return dict(row)
    finally:
        await conn.close()


# ---------------------------------------------------------------------------
# happy path: void a partial payment, audit trail preserved
# ---------------------------------------------------------------------------

async def test_void_partial_payment_reverses_without_deleting(client: httpx.AsyncClient):
    sale_id, _ = await _create_unpaid_sale(client, "A", amount=100000)
    cb_id = await _ensure_cashbox(client, "PayVoid-Cashbox-A")

    pay_resp = await client.post(f"/api/v1/sale/sales/{sale_id}/pay", json={
        "amount": 40000, "cashbox_id": cb_id,
    })
    assert pay_resp.status_code == 200, pay_resp.text
    body = pay_resp.json()
    assert body["status"] == "partial"
    movement_id = body["movement_id"]
    assert movement_id is not None

    void_resp = await client.post(f"/api/v1/sale/sales/{sale_id}/pay/{movement_id}/void")
    assert void_resp.status_code == 200, void_resp.text
    vbody = void_resp.json()
    assert float(vbody["paid_amount"]) == 0
    assert vbody["status"] == "confirmed"

    get_resp = await client.get(f"/api/v1/sale/sales/{sale_id}")
    head = get_resp.json()["head"]
    assert float(head["paid_amount"]) == 0

    # audit trail: original row kept, marked voided; compensating row exists
    original = await _movement_row(movement_id)
    assert original["voided_at"] is not None
    assert original["direction"] == "in"

    conn = await asyncpg.connect(_PG_DSN)
    try:
        comp = await conn.fetchrow(
            "SELECT amount, direction FROM cash_movements WHERE void_of_id = $1", movement_id,
        )
    finally:
        await conn.close()
    assert comp is not None
    assert comp["direction"] == "out"
    assert float(comp["amount"]) == 40000


# ---------------------------------------------------------------------------
# double-void -> 409
# ---------------------------------------------------------------------------

async def test_double_void_returns_409(client: httpx.AsyncClient):
    sale_id, _ = await _create_unpaid_sale(client, "B", amount=50000)
    cb_id = await _ensure_cashbox(client, "PayVoid-Cashbox-B")
    pay_resp = await client.post(f"/api/v1/sale/sales/{sale_id}/pay", json={
        "amount": 20000, "cashbox_id": cb_id,
    })
    movement_id = pay_resp.json()["movement_id"]

    first = await client.post(f"/api/v1/sale/sales/{sale_id}/pay/{movement_id}/void")
    assert first.status_code == 200, first.text

    second = await client.post(f"/api/v1/sale/sales/{sale_id}/pay/{movement_id}/void")
    assert second.status_code == 409, second.text


# ---------------------------------------------------------------------------
# sale already fully paid -> void blocked (loyalty earn-on-pay guard)
# ---------------------------------------------------------------------------

async def test_void_blocked_once_sale_is_fully_paid(client: httpx.AsyncClient):
    sale_id, _ = await _create_unpaid_sale(client, "C", amount=30000)
    cb_id = await _ensure_cashbox(client, "PayVoid-Cashbox-C")
    pay_resp = await client.post(f"/api/v1/sale/sales/{sale_id}/pay", json={
        "amount": 30000, "cashbox_id": cb_id,
    })
    assert pay_resp.json()["status"] == "paid"
    movement_id = pay_resp.json()["movement_id"]

    void_resp = await client.post(f"/api/v1/sale/sales/{sale_id}/pay/{movement_id}/void")
    assert void_resp.status_code == 409, void_resp.text


# ---------------------------------------------------------------------------
# movement belonging to a different sale -> 404
# ---------------------------------------------------------------------------

async def test_void_rejects_movement_from_another_sale(client: httpx.AsyncClient):
    sale_a, _ = await _create_unpaid_sale(client, "D1", amount=10000)
    sale_b, _ = await _create_unpaid_sale(client, "D2", amount=10000)
    cb_id = await _ensure_cashbox(client, "PayVoid-Cashbox-D")

    pay_a = await client.post(f"/api/v1/sale/sales/{sale_a}/pay", json={
        "amount": 5000, "cashbox_id": cb_id,
    })
    movement_id = pay_a.json()["movement_id"]

    cross_void = await client.post(f"/api/v1/sale/sales/{sale_b}/pay/{movement_id}/void")
    assert cross_void.status_code == 404, cross_void.text
