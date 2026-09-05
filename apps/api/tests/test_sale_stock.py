"""
T-201 — Sale allow_negative guard + _stock_apply unified.

Verifies that:
- Selling more than on_hand quantity returns 422 and stock is unchanged
- Selling exactly on_hand quantity succeeds and brings stock to 0
- Selling less than on_hand quantity succeeds and stock is reduced correctly
- Cancelling a confirmed sale restores stock
- Creating a sale return restores stock
- stock_movements journal records a row per sale confirm

Run: docker exec erp-api pytest apps/api/tests/test_sale_stock.py -v
"""
import pytest
import httpx

from tests.conftest import API_URL

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

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


async def _set_stock(client: httpx.AsyncClient, wh_id: int, product_id: str, qty: str) -> None:
    """Set exact stock level using inventory adjust (finish sets absolute quantity)."""
    r = await client.post("/api/v1/warehouse/inventories", json={
        "warehouse_id": wh_id,
        "items": [{"product_id": product_id, "actual_qty": qty}],
    })
    assert r.status_code in (200, 201), f"inventory create: {r.text}"
    iid = r.json()["id"]
    r = await client.post(f"/api/v1/warehouse/inventories/{iid}/finish")
    assert r.status_code == 200, f"inventory finish: {r.text}"


async def _get_stock(client: httpx.AsyncClient, wh_id: int, product_id: str) -> float:
    """Read current on_hand for product in warehouse."""
    r = await client.get("/api/v1/warehouse/stock/on-hand",
                         params={"warehouse_id": wh_id, "product_id": product_id})
    assert r.status_code == 200, f"on-hand read: {r.text}"
    rows = r.json()
    if not rows:
        return 0.0
    return float(rows[0]["qty"])


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

async def test_sale_negative_stock_blocked(client: httpx.AsyncClient):
    """Selling qty > on_hand must return 422; stock must remain unchanged."""
    wh_id = await _ensure_warehouse(client, "T201-TestWarehouse")
    pid = await _ensure_product(client, "T201-Product-A")
    cur_id = await _get_currency_id(client)

    await _set_stock(client, wh_id, pid, "5")

    r = await client.post("/api/v1/sale/sales", json={
        "warehouse_id": wh_id,
        "currency_id": cur_id,
        "items": [{"product_id": pid, "quantity": 10, "price": 100, "discount": 0}],
    })
    assert r.status_code == 422, f"Expected 422, got {r.status_code}: {r.text}"

    stock_after = await _get_stock(client, wh_id, pid)
    assert stock_after == 5.0, f"Stock must remain 5, got {stock_after}"


async def test_sale_exact_on_hand_succeeds(client: httpx.AsyncClient):
    """Selling exactly on_hand qty must succeed and bring stock to 0."""
    wh_id = await _ensure_warehouse(client, "T201-TestWarehouse")
    pid = await _ensure_product(client, "T201-Product-B")
    cur_id = await _get_currency_id(client)

    await _set_stock(client, wh_id, pid, "7")

    r = await client.post("/api/v1/sale/sales", json={
        "warehouse_id": wh_id,
        "currency_id": cur_id,
        "items": [{"product_id": pid, "quantity": 7, "price": 100, "discount": 0}],
    })
    assert r.status_code == 201, f"Expected 201, got {r.status_code}: {r.text}"

    stock_after = await _get_stock(client, wh_id, pid)
    assert stock_after == 0.0, f"Stock must be 0 after selling all, got {stock_after}"

    sale_id = r.json()["id"]
    # cleanup
    await client.post(f"/api/v1/sale/sales/{sale_id}/cancel")


async def test_sale_partial_deduction(client: httpx.AsyncClient):
    """Selling qty < on_hand must deduct exactly that quantity."""
    wh_id = await _ensure_warehouse(client, "T201-TestWarehouse")
    pid = await _ensure_product(client, "T201-Product-C")
    cur_id = await _get_currency_id(client)

    await _set_stock(client, wh_id, pid, "10")

    r = await client.post("/api/v1/sale/sales", json={
        "warehouse_id": wh_id,
        "currency_id": cur_id,
        "items": [{"product_id": pid, "quantity": 3, "price": 100, "discount": 0}],
    })
    assert r.status_code == 201, f"Expected 201, got {r.status_code}: {r.text}"

    stock_after = await _get_stock(client, wh_id, pid)
    assert stock_after == 7.0, f"Expected 7, got {stock_after}"

    sale_id = r.json()["id"]
    await client.post(f"/api/v1/sale/sales/{sale_id}/cancel")


async def test_sale_cancel_restores_stock(client: httpx.AsyncClient):
    """Cancelling a confirmed sale must restore stock to pre-sale level."""
    wh_id = await _ensure_warehouse(client, "T201-TestWarehouse")
    pid = await _ensure_product(client, "T201-Product-D")
    cur_id = await _get_currency_id(client)

    await _set_stock(client, wh_id, pid, "10")

    r = await client.post("/api/v1/sale/sales", json={
        "warehouse_id": wh_id,
        "currency_id": cur_id,
        "items": [{"product_id": pid, "quantity": 4, "price": 100, "discount": 0}],
    })
    assert r.status_code == 201, f"sale create: {r.text}"
    sale_id = r.json()["id"]

    stock_after_sale = await _get_stock(client, wh_id, pid)
    assert stock_after_sale == 6.0, f"Expected 6 after sale, got {stock_after_sale}"

    cancel_r = await client.post(f"/api/v1/sale/sales/{sale_id}/cancel")
    assert cancel_r.status_code == 200, f"cancel: {cancel_r.text}"

    stock_after_cancel = await _get_stock(client, wh_id, pid)
    assert stock_after_cancel == 10.0, f"Expected 10 after cancel, got {stock_after_cancel}"


async def test_sale_return_restores_stock(client: httpx.AsyncClient):
    """Creating a sale return must add stock back to warehouse."""
    wh_id = await _ensure_warehouse(client, "T201-TestWarehouse")
    pid = await _ensure_product(client, "T201-Product-E")
    cur_id = await _get_currency_id(client)

    await _set_stock(client, wh_id, pid, "10")

    sale_r = await client.post("/api/v1/sale/sales", json={
        "warehouse_id": wh_id,
        "currency_id": cur_id,
        "items": [{"product_id": pid, "quantity": 5, "price": 100, "discount": 0}],
    })
    assert sale_r.status_code == 201, f"sale create: {sale_r.text}"
    sale_id = sale_r.json()["id"]

    stock_after_sale = await _get_stock(client, wh_id, pid)
    assert stock_after_sale == 5.0

    return_r = await client.post("/api/v1/sale/returns", json={
        "sale_id": sale_id,
        "warehouse_id": wh_id,
        "currency_id": cur_id,
        "items": [{"product_id": pid, "quantity": 2, "price": 100, "discount": 0}],
    })
    assert return_r.status_code == 201, f"return create: {return_r.text}"

    stock_after_return = await _get_stock(client, wh_id, pid)
    assert stock_after_return == 7.0, f"Expected 7 after return of 2, got {stock_after_return}"

    # cleanup
    await client.post(f"/api/v1/sale/sales/{sale_id}/cancel")


async def test_sale_movements_journal_entry(client: httpx.AsyncClient):
    """Each confirmed sale must write a stock_movements row with operation_type='sale'."""
    wh_id = await _ensure_warehouse(client, "T201-TestWarehouse")
    pid = await _ensure_product(client, "T201-Product-F")
    cur_id = await _get_currency_id(client)

    await _set_stock(client, wh_id, pid, "20")

    sale_r = await client.post("/api/v1/sale/sales", json={
        "warehouse_id": wh_id,
        "currency_id": cur_id,
        "items": [{"product_id": pid, "quantity": 3, "price": 100, "discount": 0}],
    })
    assert sale_r.status_code == 201, f"sale create: {sale_r.text}"
    sale_id = sale_r.json()["id"]

    mv_r = await client.get("/api/v1/warehouse/movements", params={
        "warehouse_id": wh_id,
        "product_id": pid,
        "limit": 10,
    })
    assert mv_r.status_code == 200, f"movements: {mv_r.text}"
    movements = mv_r.json()
    items = movements if isinstance(movements, list) else movements.get("items", [])

    sale_movements = [m for m in items if m.get("operation_type") == "sale"
                      and m.get("source_id") == sale_id]
    assert len(sale_movements) >= 1, (
        f"Expected at least 1 'sale' movement for sale_id={sale_id}, got: {items}"
    )
    assert float(sale_movements[0]["change_qty"]) == -3.0

    # cleanup
    await client.post(f"/api/v1/sale/sales/{sale_id}/cancel")


async def test_multi_item_sale_one_negative_rolls_back(client: httpx.AsyncClient):
    """Multi-item sale where one item has insufficient stock must be fully rejected (422)."""
    wh_id = await _ensure_warehouse(client, "T201-TestWarehouse")
    pid_ok = await _ensure_product(client, "T201-Product-G")
    pid_short = await _ensure_product(client, "T201-Product-H")
    cur_id = await _get_currency_id(client)

    await _set_stock(client, wh_id, pid_ok, "10")
    await _set_stock(client, wh_id, pid_short, "2")

    before_ok = await _get_stock(client, wh_id, pid_ok)
    before_short = await _get_stock(client, wh_id, pid_short)

    r = await client.post("/api/v1/sale/sales", json={
        "warehouse_id": wh_id,
        "currency_id": cur_id,
        "items": [
            {"product_id": pid_ok, "quantity": 5, "price": 100, "discount": 0},
            {"product_id": pid_short, "quantity": 10, "price": 100, "discount": 0},
        ],
    })
    assert r.status_code == 422, f"Expected 422, got {r.status_code}: {r.text}"

    after_ok = await _get_stock(client, wh_id, pid_ok)
    after_short = await _get_stock(client, wh_id, pid_short)

    assert after_ok == before_ok, f"pid_ok stock must be unchanged: {before_ok} vs {after_ok}"
    assert after_short == before_short, f"pid_short stock must be unchanged: {before_short} vs {after_short}"
