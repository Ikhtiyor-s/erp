"""
Integration tests for internal transfer workflow (T-005).
Requires a running API with the test org seeded (qa@example.com / Qa12345!).
Run inside container: docker exec erp-api pytest apps/api/tests/test_warehouse_transfer.py -v
"""
import pytest
import pytest_asyncio
import httpx

from tests.conftest import API_URL


pytestmark = pytest.mark.asyncio


async def _ensure_warehouse(client: httpx.AsyncClient, name: str) -> int:
    """Return warehouse id, creating it if it doesn't exist."""
    r = await client.get("/api/v1/warehouse/warehouses")
    assert r.status_code == 200
    for wh in r.json():
        if wh["name"] == name:
            return wh["id"]
    r = await client.post("/api/v1/warehouse/warehouses", json={"name": name})
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def _ensure_product(client: httpx.AsyncClient, name: str) -> str:
    """Return product id (uuid str), creating it if missing."""
    r = await client.get("/api/v1/warehouse/products", params={"q": name})
    assert r.status_code == 200
    for p in r.json():
        if p["name"] == name:
            return p["id"]
    r = await client.post("/api/v1/warehouse/products",
                          json={"name": name, "purchase_price": "1000"})
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def _set_stock(client: httpx.AsyncClient, warehouse_id: int,
                     product_id: str, qty: str) -> None:
    """Seed stock via inventory creation + finish (actual_qty > 0 raises balance from 0)."""
    r = await client.post("/api/v1/warehouse/inventories", json={
        "warehouse_id": warehouse_id,
        "items": [{"product_id": product_id, "actual_qty": qty}],
    })
    assert r.status_code in (200, 201), f"inventory create failed: {r.text}"
    iid = r.json()["id"]
    r = await client.post(f"/api/v1/warehouse/inventories/{iid}/finish")
    assert r.status_code == 200, f"inventory finish failed: {r.text}"


async def _get_stock(client: httpx.AsyncClient, warehouse_id: int, product_id: str):
    r = await client.get("/api/v1/warehouse/stock/on-hand",
                         params={"warehouse_id": warehouse_id, "product_id": product_id})
    assert r.status_code == 200
    data = r.json()
    if data:
        return data[0]["qty"]
    return "0"


@pytest.mark.asyncio
async def test_transfer_create_send_receive(client: httpx.AsyncClient):
    """Full happy path: create draft → send (stock deducted) → receive (stock credited)."""
    src = await _ensure_warehouse(client, "_TEST_SRC_TRANSFER")
    dst = await _ensure_warehouse(client, "_TEST_DST_TRANSFER")
    pid = await _ensure_product(client, "_TEST_PRODUCT_TRANSFER")

    await _set_stock(client, src, pid, "20")

    # Create draft
    r = await client.post("/api/v1/warehouse/transfers", json={
        "from_warehouse": src,
        "to_warehouse": dst,
        "items": [{"product_id": pid, "qty": "10"}],
    })
    assert r.status_code == 201, r.text
    data = r.json()
    tid = data["id"]
    assert data["doc_number"].startswith("TRF-")

    # List includes our draft
    r = await client.get("/api/v1/warehouse/transfers", params={"status": "draft"})
    assert r.status_code == 200
    ids = [t["id"] for t in r.json()["items"]]
    assert tid in ids

    # Send
    r = await client.post(f"/api/v1/warehouse/transfers/{tid}/send")
    assert r.status_code == 200, r.text
    assert r.json()["ok"] is True

    # Get detail — status=sent
    r = await client.get(f"/api/v1/warehouse/transfers/{tid}")
    assert r.status_code == 200
    assert r.json()["status"] == "sent"

    # Receive
    r = await client.post(f"/api/v1/warehouse/transfers/{tid}/receive")
    assert r.status_code == 200, r.text
    assert r.json()["ok"] is True

    # Get detail — status=received
    r = await client.get(f"/api/v1/warehouse/transfers/{tid}")
    assert r.status_code == 200
    assert r.json()["status"] == "received"

    # Dst now has stock
    dst_qty = await _get_stock(client, dst, pid)
    assert float(dst_qty) >= 10.0


@pytest.mark.asyncio
async def test_transfer_second_receive_returns_409(client: httpx.AsyncClient):
    """Calling receive on an already-received transfer returns 409."""
    src = await _ensure_warehouse(client, "_TEST_SRC2_TRANSFER")
    dst = await _ensure_warehouse(client, "_TEST_DST2_TRANSFER")
    pid = await _ensure_product(client, "_TEST_PRODUCT_TRANSFER2")

    await _set_stock(client, src, pid, "10")

    r = await client.post("/api/v1/warehouse/transfers", json={
        "from_warehouse": src, "to_warehouse": dst,
        "items": [{"product_id": pid, "qty": "5"}],
    })
    assert r.status_code == 201
    tid = r.json()["id"]

    await client.post(f"/api/v1/warehouse/transfers/{tid}/send")
    await client.post(f"/api/v1/warehouse/transfers/{tid}/receive")

    r2 = await client.post(f"/api/v1/warehouse/transfers/{tid}/receive")
    assert r2.status_code == 409


@pytest.mark.asyncio
async def test_transfer_send_insufficient_stock_returns_422(client: httpx.AsyncClient):
    """Sending more than on-hand returns 422 with product name in detail."""
    src = await _ensure_warehouse(client, "_TEST_SRC3_TRANSFER")
    dst = await _ensure_warehouse(client, "_TEST_DST3_TRANSFER")
    pid = await _ensure_product(client, "_TEST_PRODUCT_TRANSFER3")

    # Ensure very low stock (do NOT seed any extra, just use 0 stock product)
    r = await client.post("/api/v1/warehouse/transfers", json={
        "from_warehouse": src, "to_warehouse": dst,
        "items": [{"product_id": pid, "qty": "9999"}],
    })
    assert r.status_code == 201
    tid = r.json()["id"]

    r = await client.post(f"/api/v1/warehouse/transfers/{tid}/send")
    assert r.status_code == 422
    assert "_TEST_PRODUCT_TRANSFER3" in r.json()["detail"]


@pytest.mark.asyncio
async def test_transfer_cancel_sent_recredits_stock(client: httpx.AsyncClient):
    """Cancelling a sent transfer re-credits source stock exactly."""
    src = await _ensure_warehouse(client, "_TEST_SRC4_TRANSFER")
    dst = await _ensure_warehouse(client, "_TEST_DST4_TRANSFER")
    pid = await _ensure_product(client, "_TEST_PRODUCT_TRANSFER4")

    await _set_stock(client, src, pid, "15")
    before_qty = float(await _get_stock(client, src, pid))

    r = await client.post("/api/v1/warehouse/transfers", json={
        "from_warehouse": src, "to_warehouse": dst,
        "items": [{"product_id": pid, "qty": "7"}],
    })
    assert r.status_code == 201
    tid = r.json()["id"]

    await client.post(f"/api/v1/warehouse/transfers/{tid}/send")
    mid_qty = float(await _get_stock(client, src, pid))
    # After send, src decreased
    assert mid_qty < before_qty

    r = await client.post(f"/api/v1/warehouse/transfers/{tid}/cancel")
    assert r.status_code == 200, r.text

    after_qty = float(await _get_stock(client, src, pid))
    # After cancel, src should be restored
    assert abs(after_qty - before_qty) < 0.01


@pytest.mark.asyncio
async def test_transfer_from_equals_to_returns_422(client: httpx.AsyncClient):
    """from_warehouse == to_warehouse must be rejected."""
    src = await _ensure_warehouse(client, "_TEST_SRC5_TRANSFER")
    pid = await _ensure_product(client, "_TEST_PRODUCT_TRANSFER5")

    r = await client.post("/api/v1/warehouse/transfers", json={
        "from_warehouse": src, "to_warehouse": src,
        "items": [{"product_id": pid, "qty": "1"}],
    })
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_transfer_cancel_received_returns_409(client: httpx.AsyncClient):
    """Cancelling a received transfer returns 409."""
    src = await _ensure_warehouse(client, "_TEST_SRC6_TRANSFER")
    dst = await _ensure_warehouse(client, "_TEST_DST6_TRANSFER")
    pid = await _ensure_product(client, "_TEST_PRODUCT_TRANSFER6")

    await _set_stock(client, src, pid, "5")

    r = await client.post("/api/v1/warehouse/transfers", json={
        "from_warehouse": src, "to_warehouse": dst,
        "items": [{"product_id": pid, "qty": "3"}],
    })
    assert r.status_code == 201
    tid = r.json()["id"]

    await client.post(f"/api/v1/warehouse/transfers/{tid}/send")
    await client.post(f"/api/v1/warehouse/transfers/{tid}/receive")

    r = await client.post(f"/api/v1/warehouse/transfers/{tid}/cancel")
    assert r.status_code == 409
