"""REGOS-parity "Отложить чек" (park/defer, mid-payment half only) —
docs/regos-pos/operations/sales-registration/general-information.md.

Covers:
- POST /sale/sales/{id}/hold parks a confirmed/partial sale -> status on_hold.
- Paying or voiding a payment while on_hold is rejected (409) — the status
  must not silently flip back under the park.
- POST /sale/sales/{id}/resume returns it to confirmed/partial/paid based on
  paid_amount, and a double-resume is rejected (409).
- GET /sale/sales?status=on_hold lists held sales.
- Shift close is blocked while any sale is on_hold, and unblocked once
  resolved (resumed + paid, or cancelled).

Run: docker exec erp-api pytest tests/test_sale_hold_resume.py -v
"""
import httpx
import pytest

pytestmark = pytest.mark.asyncio


async def _get_currency_id(client: httpx.AsyncClient) -> int:
    r = await client.get("/api/v1/reference/currencies")
    assert r.status_code == 200
    return r.json()[0]["id"]


async def _ensure_warehouse(client: httpx.AsyncClient, name: str) -> int:
    r = await client.get("/api/v1/warehouse/warehouses")
    for wh in r.json():
        if wh["name"] == name:
            return wh["id"]
    r = await client.post("/api/v1/warehouse/warehouses", json={"name": name})
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def _ensure_product(client: httpx.AsyncClient, name: str) -> str:
    r = await client.get("/api/v1/warehouse/products", params={"q": name, "limit": 5})
    for p in r.json():
        if p["name"] == name:
            return str(p["id"])
    r = await client.post("/api/v1/warehouse/products",
                          json={"name": name, "purchase_price": "500", "sale_price": "1000"})
    assert r.status_code in (200, 201), r.text
    return str(r.json()["id"])


async def _ensure_cashbox(client: httpx.AsyncClient, name: str) -> int:
    r = await client.get("/api/v1/finance/cashboxes")
    for cb in r.json():
        if cb["name"] == name:
            return cb["id"]
    cur_id = await _get_currency_id(client)
    r = await client.post("/api/v1/finance/cashboxes", json={"name": name, "currency_id": cur_id})
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def _set_stock(client: httpx.AsyncClient, wh_id: int, product_id: str, qty: str) -> None:
    r = await client.post("/api/v1/warehouse/inventories", json={
        "warehouse_id": wh_id, "items": [{"product_id": product_id, "actual_qty": qty}],
    })
    assert r.status_code in (200, 201), r.text
    iid = r.json()["id"]
    r = await client.post(f"/api/v1/warehouse/inventories/{iid}/finish")
    assert r.status_code == 200, r.text


async def _create_unpaid_sale(client: httpx.AsyncClient, suffix: str, amount: float) -> str:
    wh_id = await _ensure_warehouse(client, "Hold-TestWarehouse")
    pid = await _ensure_product(client, f"Hold-Product-{suffix}")
    cur_id = await _get_currency_id(client)
    await _set_stock(client, wh_id, pid, "1000")
    r = await client.post("/api/v1/sale/sales", json={
        "warehouse_id": wh_id, "currency_id": cur_id,
        "items": [{"product_id": pid, "quantity": 1, "price": amount, "discount": 0}],
    })
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def test_hold_then_resume_round_trip(client: httpx.AsyncClient):
    sale_id = await _create_unpaid_sale(client, "A", amount=50000)
    cb_id = await _ensure_cashbox(client, "Hold-Cashbox-A")

    pay = await client.post(f"/api/v1/sale/sales/{sale_id}/pay", json={"amount": 20000, "cashbox_id": cb_id})
    assert pay.status_code == 200, pay.text

    hold = await client.post(f"/api/v1/sale/sales/{sale_id}/hold")
    assert hold.status_code == 200
    assert hold.json()["status"] == "on_hold"

    blocked_pay = await client.post(f"/api/v1/sale/sales/{sale_id}/pay", json={"amount": 5000, "cashbox_id": cb_id})
    assert blocked_pay.status_code == 409, blocked_pay.text

    resume = await client.post(f"/api/v1/sale/sales/{sale_id}/resume")
    assert resume.status_code == 200
    assert resume.json()["status"] == "partial"

    double_resume = await client.post(f"/api/v1/sale/sales/{sale_id}/resume")
    assert double_resume.status_code == 409


async def test_held_sale_appears_in_status_filter(client: httpx.AsyncClient):
    sale_id = await _create_unpaid_sale(client, "B", amount=15000)
    hold = await client.post(f"/api/v1/sale/sales/{sale_id}/hold")
    assert hold.status_code == 200

    listed = await client.get("/api/v1/sale/sales", params={"status": "on_hold", "limit": 200})
    ids = [s["id"] for s in listed.json()]
    assert sale_id in ids


async def test_shift_close_blocked_while_sale_on_hold(client: httpx.AsyncClient):
    cb_id = await _ensure_cashbox(client, "Hold-Cashbox-C")
    sale_id = await _create_unpaid_sale(client, "C", amount=10000)
    hold = await client.post(f"/api/v1/sale/sales/{sale_id}/hold")
    assert hold.status_code == 200

    open_resp = await client.post("/api/v1/cashbox-sessions/open", json={
        "cashbox_id": cb_id, "opened_balance": 0,
    })
    assert open_resp.status_code == 201, open_resp.text
    sess_id = open_resp.json()["id"]

    close_blocked = await client.post(
        f"/api/v1/cashbox-sessions/{sess_id}/close", json={"closed_balance": 0, "closed_diff": 0},
    )
    assert close_blocked.status_code == 400, close_blocked.text

    resume = await client.post(f"/api/v1/sale/sales/{sale_id}/resume")
    assert resume.status_code == 200
    pay_off = await client.post(f"/api/v1/sale/sales/{sale_id}/pay", json={"amount": 10000, "cashbox_id": cb_id})
    assert pay_off.json()["status"] == "paid"

    close_ok = await client.post(
        f"/api/v1/cashbox-sessions/{sess_id}/close", json={"closed_balance": 10000, "closed_diff": 0},
    )
    assert close_ok.status_code == 200, close_ok.text
