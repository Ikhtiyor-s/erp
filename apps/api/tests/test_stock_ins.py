"""
Integration tests for stock-in (oprihodovanie) workflow (T-210).
Requires a running API with the test org seeded (qa@example.com / Qa12345!).
Run inside container: docker exec erp-api pytest apps/api/tests/test_stock_ins.py -v
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


async def _get_stock(client: httpx.AsyncClient, warehouse_id: int, product_id: str) -> str:
    r = await client.get("/api/v1/warehouse/stock/on-hand",
                         params={"warehouse_id": warehouse_id, "product_id": product_id})
    assert r.status_code == 200
    data = r.json()
    return data[0]["qty"] if data else "0"


@pytest.mark.asyncio
async def test_stock_in_create_confirm_stock_increases(client: httpx.AsyncClient):
    """Happy path: create draft → confirm → stock quantity increases."""
    wh = await _ensure_warehouse(client, "_TEST_WH_STOCKIN")
    pid = await _ensure_product(client, "_TEST_PRODUCT_STOCKIN_A")

    qty_before = float(await _get_stock(client, wh, pid))

    r = await client.post("/api/v1/warehouse/stock-ins", json={
        "warehouse_id": wh,
        "reason": "Inventarizatsiya topildi",
        "items": [{"product_id": pid, "quantity": "10", "unit_cost": "100"}],
    })
    assert r.status_code == 201, r.text
    data = r.json()
    sid = data["id"]
    assert data["doc_number"].startswith("SI-")

    r = await client.get(f"/api/v1/warehouse/stock-ins/{sid}")
    assert r.status_code == 200
    assert r.json()["head"]["status"] == "draft"

    r = await client.post(f"/api/v1/warehouse/stock-ins/{sid}/confirm")
    assert r.status_code == 200, r.text
    assert r.json()["ok"] is True

    r = await client.get(f"/api/v1/warehouse/stock-ins/{sid}")
    assert r.json()["head"]["status"] == "confirmed"

    qty_after = float(await _get_stock(client, wh, pid))
    assert qty_after == qty_before + 10.0


@pytest.mark.asyncio
async def test_stock_in_confirm_creates_movement_oprihodovanie(client: httpx.AsyncClient):
    """After confirm, stock_movements has a row with operation_type='oprihodovanie'."""
    wh = await _ensure_warehouse(client, "_TEST_WH_STOCKIN")
    pid = await _ensure_product(client, "_TEST_PRODUCT_STOCKIN_B")

    r = await client.post("/api/v1/warehouse/stock-ins", json={
        "warehouse_id": wh,
        "reason": "count_correction",
        "items": [{"product_id": pid, "quantity": "5", "unit_cost": "200"}],
    })
    assert r.status_code == 201, r.text
    sid = r.json()["id"]

    r = await client.post(f"/api/v1/warehouse/stock-ins/{sid}/confirm")
    assert r.status_code == 200, r.text

    r = await client.get("/api/v1/warehouse/movements", params={
        "warehouse_id": wh,
        "product_id": pid,
        "operation_type": "oprihodovanie",
        "limit": 10,
    })
    assert r.status_code == 200, r.text
    movements = r.json()
    items = movements.get("items", movements) if isinstance(movements, dict) else movements
    ops = [m for m in items if m.get("operation_type") == "oprihodovanie"
           and m.get("source_id") == sid]
    assert len(ops) >= 1, f"No oprihodovanie movement found for stock_in {sid}"
    assert float(ops[0]["change_qty"]) == 5.0


@pytest.mark.asyncio
async def test_stock_in_patch_confirmed_returns_422(client: httpx.AsyncClient):
    """PATCH on a confirmed stock-in must return 422."""
    wh = await _ensure_warehouse(client, "_TEST_WH_STOCKIN")
    pid = await _ensure_product(client, "_TEST_PRODUCT_STOCKIN_C")

    r = await client.post("/api/v1/warehouse/stock-ins", json={
        "warehouse_id": wh,
        "items": [{"product_id": pid, "quantity": "3"}],
    })
    assert r.status_code == 201, r.text
    sid = r.json()["id"]

    await client.post(f"/api/v1/warehouse/stock-ins/{sid}/confirm")

    r = await client.patch(f"/api/v1/warehouse/stock-ins/{sid}", json={"reason": "changed"})
    assert r.status_code == 422, r.text


@pytest.mark.asyncio
async def test_stock_in_cancel_confirmed_returns_422(client: httpx.AsyncClient):
    """Cancelling a confirmed stock-in must return 422."""
    wh = await _ensure_warehouse(client, "_TEST_WH_STOCKIN")
    pid = await _ensure_product(client, "_TEST_PRODUCT_STOCKIN_D")

    r = await client.post("/api/v1/warehouse/stock-ins", json={
        "warehouse_id": wh,
        "items": [{"product_id": pid, "quantity": "2"}],
    })
    assert r.status_code == 201, r.text
    sid = r.json()["id"]

    await client.post(f"/api/v1/warehouse/stock-ins/{sid}/confirm")

    r = await client.post(f"/api/v1/warehouse/stock-ins/{sid}/cancel")
    assert r.status_code == 422, r.text


@pytest.mark.asyncio
async def test_stock_in_cancel_draft(client: httpx.AsyncClient):
    """Cancelling a draft stock-in must succeed."""
    wh = await _ensure_warehouse(client, "_TEST_WH_STOCKIN")
    pid = await _ensure_product(client, "_TEST_PRODUCT_STOCKIN_E")

    r = await client.post("/api/v1/warehouse/stock-ins", json={
        "warehouse_id": wh,
        "items": [{"product_id": pid, "quantity": "7"}],
    })
    assert r.status_code == 201, r.text
    sid = r.json()["id"]

    r = await client.post(f"/api/v1/warehouse/stock-ins/{sid}/cancel")
    assert r.status_code == 200, r.text
    assert r.json()["ok"] is True

    r = await client.get(f"/api/v1/warehouse/stock-ins/{sid}")
    assert r.json()["head"]["status"] == "cancelled"


@pytest.mark.asyncio
async def test_stock_in_doc_number_sequential(client: httpx.AsyncClient):
    """Two consecutive stock-ins get sequential SI-YYYY-NNNNN doc numbers."""
    wh = await _ensure_warehouse(client, "_TEST_WH_STOCKIN")
    pid = await _ensure_product(client, "_TEST_PRODUCT_STOCKIN_F")

    r1 = await client.post("/api/v1/warehouse/stock-ins", json={
        "warehouse_id": wh,
        "items": [{"product_id": pid, "quantity": "1"}],
    })
    assert r1.status_code == 201, r1.text

    r2 = await client.post("/api/v1/warehouse/stock-ins", json={
        "warehouse_id": wh,
        "items": [{"product_id": pid, "quantity": "1"}],
    })
    assert r2.status_code == 201, r2.text

    dn1 = r1.json()["doc_number"]
    dn2 = r2.json()["doc_number"]
    assert dn1.startswith("SI-"), f"doc_number must start with SI-: {dn1}"
    assert dn2.startswith("SI-"), f"doc_number must start with SI-: {dn2}"
    n1 = int(dn1.split("-")[-1])
    n2 = int(dn2.split("-")[-1])
    assert n2 == n1 + 1, f"Sequential: expected {n1+1} got {n2}"


@pytest.mark.asyncio
async def test_stock_in_list_filter_by_status(client: httpx.AsyncClient):
    """GET /stock-ins?status=draft returns only draft records."""
    wh = await _ensure_warehouse(client, "_TEST_WH_STOCKIN")
    pid = await _ensure_product(client, "_TEST_PRODUCT_STOCKIN_G")

    r = await client.post("/api/v1/warehouse/stock-ins", json={
        "warehouse_id": wh,
        "items": [{"product_id": pid, "quantity": "1"}],
    })
    assert r.status_code == 201, r.text

    r = await client.get("/api/v1/warehouse/stock-ins", params={"status": "draft"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "items" in data
    assert all(item["status"] == "draft" for item in data["items"])


@pytest.mark.asyncio
async def test_stock_in_delete_draft(client: httpx.AsyncClient):
    """DELETE on a draft stock-in removes it."""
    wh = await _ensure_warehouse(client, "_TEST_WH_STOCKIN")
    pid = await _ensure_product(client, "_TEST_PRODUCT_STOCKIN_H")

    r = await client.post("/api/v1/warehouse/stock-ins", json={
        "warehouse_id": wh,
        "items": [{"product_id": pid, "quantity": "1"}],
    })
    assert r.status_code == 201, r.text
    sid = r.json()["id"]

    r = await client.delete(f"/api/v1/warehouse/stock-ins/{sid}")
    assert r.status_code == 200, r.text

    r = await client.get(f"/api/v1/warehouse/stock-ins/{sid}")
    assert r.status_code == 404
