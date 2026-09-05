"""
Integration tests for product request flow and stock on-hand endpoint (T-005).
Run inside container: docker exec erp-api pytest apps/api/tests/test_warehouse_request.py -v
"""
import pytest
import pytest_asyncio
import httpx

from tests.conftest import API_URL


pytestmark = pytest.mark.asyncio


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
    r = await client.get("/api/v1/warehouse/products", params={"q": name})
    assert r.status_code == 200
    for p in r.json():
        if p["name"] == name:
            return p["id"]
    r = await client.post("/api/v1/warehouse/products",
                          json={"name": name, "purchase_price": "500"})
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def _seed_stock(client: httpx.AsyncClient, warehouse_id: int,
                      product_id: str, qty: str) -> None:
    """Seed stock via inventory creation + finish."""
    r = await client.post("/api/v1/warehouse/inventories", json={
        "warehouse_id": warehouse_id,
        "items": [{"product_id": product_id, "actual_qty": qty}],
    })
    assert r.status_code in (200, 201), f"inventory create failed: {r.text}"
    iid = r.json()["id"]
    r = await client.post(f"/api/v1/warehouse/inventories/{iid}/finish")
    assert r.status_code == 200, f"inventory finish failed: {r.text}"


@pytest.mark.asyncio
async def test_stock_on_hand_returns_zero_for_no_balance(client: httpx.AsyncClient):
    """Stock on-hand returns a zero-qty row when product exists but has no balance."""
    wh = await _ensure_warehouse(client, "_TEST_WH_STOCK_ONHAND")
    pid = await _ensure_product(client, "_TEST_PROD_NO_BALANCE")

    r = await client.get("/api/v1/warehouse/stock/on-hand",
                         params={"warehouse_id": wh, "product_id": pid})
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    row = next((d for d in data if d["product_id"] == pid), None)
    assert row is not None
    assert float(row["qty"]) == 0.0


@pytest.mark.asyncio
async def test_stock_on_hand_reflects_seeded_stock(client: httpx.AsyncClient):
    """After seeding stock, on-hand endpoint reflects the balance."""
    wh = await _ensure_warehouse(client, "_TEST_WH_STOCK_SEEDED")
    pid = await _ensure_product(client, "_TEST_PROD_SEEDED_BALANCE")

    await _seed_stock(client, wh, pid, "25")

    r = await client.get("/api/v1/warehouse/stock/on-hand",
                         params={"warehouse_id": wh, "product_id": pid})
    assert r.status_code == 200
    data = r.json()
    row = next((d for d in data if d["product_id"] == pid), None)
    assert row is not None
    assert float(row["qty"]) >= 25.0


@pytest.mark.asyncio
async def test_request_create_happy_path(client: httpx.AsyncClient):
    """Creating a request with qty <= on_hand returns 201 with doc_number."""
    wh = await _ensure_warehouse(client, "_TEST_WH_REQ_OK")
    pid = await _ensure_product(client, "_TEST_PROD_REQ_OK")

    await _seed_stock(client, wh, pid, "10")

    r = await client.post("/api/v1/warehouse/requests", json={
        "from_warehouse": wh,
        "items": [{"product_id": pid, "qty_requested": "5"}],
    })
    assert r.status_code == 201, r.text
    data = r.json()
    assert "id" in data
    assert data["doc_number"].startswith("REQ-")


@pytest.mark.asyncio
async def test_request_qty_exceeds_on_hand_returns_422(client: httpx.AsyncClient):
    """Creating request with qty > on_hand returns 422 with product name."""
    wh = await _ensure_warehouse(client, "_TEST_WH_REQ_OVER")
    pid = await _ensure_product(client, "_TEST_PROD_REQ_OVER")

    # Do NOT seed stock — product has 0 on hand

    r = await client.post("/api/v1/warehouse/requests", json={
        "from_warehouse": wh,
        "items": [{"product_id": pid, "qty_requested": "999"}],
    })
    assert r.status_code == 422
    assert "_TEST_PROD_REQ_OVER" in r.json()["detail"]


@pytest.mark.asyncio
async def test_request_qty_on_hand_snapshot(client: httpx.AsyncClient):
    """qty_on_hand stored in product_request_items equals live stock at creation time."""
    wh = await _ensure_warehouse(client, "_TEST_WH_SNAPSHOT")
    pid = await _ensure_product(client, "_TEST_PROD_SNAPSHOT")

    await _seed_stock(client, wh, pid, "12")

    r = await client.post("/api/v1/warehouse/requests", json={
        "from_warehouse": wh,
        "items": [{"product_id": pid, "qty_requested": "3"}],
    })
    assert r.status_code == 201, r.text
    rid = r.json()["id"]

    # Fetch detail and verify qty_on_hand snapshot matches live stock at creation
    r = await client.get(f"/api/v1/warehouse/requests/{rid}")
    assert r.status_code == 200, r.text
    detail = r.json()
    assert "items" in detail, "Response must include items array"
    item = next((i for i in detail["items"] if i["product_id"] == pid), None)
    assert item is not None, f"product {pid} not found in request items"
    assert "qty_on_hand" in item, "qty_on_hand field must be present in item"
    assert float(item["qty_on_hand"]) >= 12.0, (
        f"qty_on_hand snapshot {item['qty_on_hand']} must reflect stock seeded (>=12)"
    )


@pytest.mark.asyncio
async def test_request_approve_happy_path(client: httpx.AsyncClient):
    """Approving a pending request changes status to approved."""
    wh = await _ensure_warehouse(client, "_TEST_WH_APPROVE")
    pid = await _ensure_product(client, "_TEST_PROD_APPROVE")

    await _seed_stock(client, wh, pid, "8")

    r = await client.post("/api/v1/warehouse/requests", json={
        "from_warehouse": wh,
        "items": [{"product_id": pid, "qty_requested": "2"}],
    })
    assert r.status_code == 201
    rid = r.json()["id"]

    r = await client.post(f"/api/v1/warehouse/requests/{rid}/approve")
    assert r.status_code == 200, r.text
    assert r.json()["ok"] is True


@pytest.mark.asyncio
async def test_request_reject_happy_path(client: httpx.AsyncClient):
    """Rejecting a pending request changes status to rejected."""
    wh = await _ensure_warehouse(client, "_TEST_WH_REJECT")
    pid = await _ensure_product(client, "_TEST_PROD_REJECT")

    await _seed_stock(client, wh, pid, "6")

    r = await client.post("/api/v1/warehouse/requests", json={
        "from_warehouse": wh,
        "items": [{"product_id": pid, "qty_requested": "1"}],
    })
    assert r.status_code == 201
    rid = r.json()["id"]

    r = await client.post(f"/api/v1/warehouse/requests/{rid}/reject")
    assert r.status_code == 200, r.text
    assert r.json()["ok"] is True


@pytest.mark.asyncio
async def test_request_approve_non_pending_returns_409(client: httpx.AsyncClient):
    """Approving an already-approved request returns 409."""
    wh = await _ensure_warehouse(client, "_TEST_WH_DBLAPP")
    pid = await _ensure_product(client, "_TEST_PROD_DBLAPP")

    await _seed_stock(client, wh, pid, "20")

    r = await client.post("/api/v1/warehouse/requests", json={
        "from_warehouse": wh,
        "items": [{"product_id": pid, "qty_requested": "1"}],
    })
    assert r.status_code == 201
    rid = r.json()["id"]

    await client.post(f"/api/v1/warehouse/requests/{rid}/approve")

    r2 = await client.post(f"/api/v1/warehouse/requests/{rid}/approve")
    assert r2.status_code == 409
