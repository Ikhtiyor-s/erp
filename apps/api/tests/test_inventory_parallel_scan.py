"""
Integration tests for T-205: Parallel scan protection + concurrent user simulation.

Covers:
  - Two users scan the same inventory concurrently — both events accepted (additive)
  - actual_qty = SUM(events) correct after multiple scans
  - DELETE scan event by owner (via admin token — same effect in test env)
  - DELETE scan event that belongs to another inventory → 404
  - DELETE scan event on completed inventory → 409
  - GET scan-events list with product_id filter
  - GET progress endpoint returns correct counts
  - blind_count=True → expected_qty hidden in items response (regression)
  - is_voided events excluded from actual_qty SUM

Run: docker exec erp-api pytest apps/api/tests/test_inventory_parallel_scan.py -v
"""
import asyncio
import pytest
import httpx

from tests.conftest import API_URL

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

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
    r = await client.post("/api/v1/warehouse/products", json={"name": name, "purchase_price": "100"})
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def _create_inventory(
    client: httpx.AsyncClient,
    wh_id: int,
    product_id: str,
    actual_qty: str = "0",
    blind_count: bool = False,
) -> str:
    r = await client.post("/api/v1/warehouse/inventories", json={
        "warehouse_id": wh_id,
        "blind_count": blind_count,
        "items": [{"product_id": product_id, "actual_qty": actual_qty}],
    })
    assert r.status_code == 201, f"create inventory: {r.text}"
    return r.json()["id"]


async def _start_inventory(client: httpx.AsyncClient, iid: str) -> None:
    r = await client.post(f"/api/v1/warehouse/inventories/{iid}/start")
    assert r.status_code == 200, r.text


async def _scan(client: httpx.AsyncClient, iid: str, pid: str, qty: str) -> dict:
    r = await client.post(f"/api/v1/warehouse/inventories/{iid}/scan-events", json={
        "product_id": pid,
        "quantity": qty,
    })
    assert r.status_code == 201, f"scan failed: {r.text}"
    return r.json()


# ---------------------------------------------------------------------------
# Test: two concurrent scans — both accepted, actual_qty = SUM
# ---------------------------------------------------------------------------

async def test_two_concurrent_scans_additive(client: httpx.AsyncClient):
    """Two users scan simultaneously — both events stored, actual_qty = sum of both."""
    wh_id = await _ensure_warehouse(client, "T205-WH-Concurrent")
    pid = await _ensure_product(client, "T205-Product-Concurrent")

    iid = await _create_inventory(client, wh_id, pid, "0")
    await _start_inventory(client, iid)

    # Simulate two concurrent scans via asyncio.gather
    async def do_scan(qty: str) -> dict:
        return await _scan(client, iid, pid, qty)

    results = await asyncio.gather(do_scan("7"), do_scan("3"))

    # Both must succeed
    assert all("scan_event_id" in r for r in results), f"Missing scan_event_id: {results}"

    # actual_qty after both scans must be 10 (7 + 3)
    r = await client.get(f"/api/v1/warehouse/inventories/{iid}/items")
    assert r.status_code == 200, r.text
    items = r.json()
    product_item = next((i for i in items if str(i["product_id"]) == pid), None)
    assert product_item is not None
    assert float(product_item["actual_qty"]) == 10.0, (
        f"Expected actual_qty=10, got {product_item['actual_qty']}"
    )


# ---------------------------------------------------------------------------
# Test: actual_qty = SUM(events) correct
# ---------------------------------------------------------------------------

async def test_actual_qty_equals_sum_of_events(client: httpx.AsyncClient):
    """Multiple scans accumulate: actual_qty = SUM(quantities)."""
    wh_id = await _ensure_warehouse(client, "T205-WH-Sum")
    pid = await _ensure_product(client, "T205-Product-Sum")

    iid = await _create_inventory(client, wh_id, pid, "0")
    await _start_inventory(client, iid)

    r1 = await _scan(client, iid, pid, "5")
    assert float(r1["actual_qty"]) == 5.0
    assert r1["scan_count"] == 1

    r2 = await _scan(client, iid, pid, "8")
    assert float(r2["actual_qty"]) == 13.0
    assert r2["scan_count"] == 2

    r3 = await _scan(client, iid, pid, "2")
    assert float(r3["actual_qty"]) == 15.0
    assert r3["scan_count"] == 3
    assert "scan_event_id" in r3
    assert "last_scanned_at" in r3


# ---------------------------------------------------------------------------
# Test: DELETE scan event by owner (admin)
# ---------------------------------------------------------------------------

async def test_delete_scan_event_by_owner(client: httpx.AsyncClient):
    """Voiding a scan event removes its quantity from actual_qty."""
    wh_id = await _ensure_warehouse(client, "T205-WH-Delete")
    pid = await _ensure_product(client, "T205-Product-Delete")

    iid = await _create_inventory(client, wh_id, pid, "0")
    await _start_inventory(client, iid)

    r1 = await _scan(client, iid, pid, "10")
    event_id = r1["scan_event_id"]

    r2 = await _scan(client, iid, pid, "5")

    # actual_qty should be 15
    items_r = await client.get(f"/api/v1/warehouse/inventories/{iid}/items")
    assert float(items_r.json()[0]["actual_qty"]) == 15.0

    # Void first event (qty=10)
    del_r = await client.delete(f"/api/v1/warehouse/inventories/{iid}/scan-events/{event_id}")
    assert del_r.status_code == 200, del_r.text
    body = del_r.json()
    assert body["ok"] is True
    assert float(body["actual_qty"]) == 5.0

    # Verify items reflects the void
    items_r = await client.get(f"/api/v1/warehouse/inventories/{iid}/items")
    assert float(items_r.json()[0]["actual_qty"]) == 5.0


# ---------------------------------------------------------------------------
# Test: DELETE scan event not found → 404
# ---------------------------------------------------------------------------

async def test_delete_nonexistent_scan_event_returns_404(client: httpx.AsyncClient):
    """Voiding a non-existent event_id returns 404."""
    wh_id = await _ensure_warehouse(client, "T205-WH-Del404")
    pid = await _ensure_product(client, "T205-Product-Del404")

    iid = await _create_inventory(client, wh_id, pid, "0")
    await _start_inventory(client, iid)

    r = await client.delete(f"/api/v1/warehouse/inventories/{iid}/scan-events/999999999")
    assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"


# ---------------------------------------------------------------------------
# Test: DELETE scan event on completed inventory → 409
# ---------------------------------------------------------------------------

async def test_delete_scan_event_on_completed_inventory_returns_409(client: httpx.AsyncClient):
    """Voiding on a completed inventory returns 409."""
    wh_id = await _ensure_warehouse(client, "T205-WH-DelComplete")
    pid = await _ensure_product(client, "T205-Product-DelComplete")

    iid = await _create_inventory(client, wh_id, pid, "0")
    await _start_inventory(client, iid)

    r1 = await _scan(client, iid, pid, "5")
    event_id = r1["scan_event_id"]

    # Advance to completed
    r = await client.post(f"/api/v1/warehouse/inventories/{iid}/submit")
    assert r.status_code == 200, r.text
    r = await client.post(f"/api/v1/warehouse/inventories/{iid}/confirm")
    assert r.status_code == 200, r.text

    r = await client.delete(f"/api/v1/warehouse/inventories/{iid}/scan-events/{event_id}")
    assert r.status_code == 409, f"Expected 409, got {r.status_code}: {r.text}"


# ---------------------------------------------------------------------------
# Test: GET scan-events list
# ---------------------------------------------------------------------------

async def test_get_scan_events_list(client: httpx.AsyncClient):
    """GET scan-events returns paginated events with correct fields."""
    wh_id = await _ensure_warehouse(client, "T205-WH-List")
    pid = await _ensure_product(client, "T205-Product-List")

    iid = await _create_inventory(client, wh_id, pid, "0")
    await _start_inventory(client, iid)

    await _scan(client, iid, pid, "4")
    await _scan(client, iid, pid, "6")

    r = await client.get(f"/api/v1/warehouse/inventories/{iid}/scan-events")
    assert r.status_code == 200, r.text
    data = r.json()
    assert "total" in data
    assert "items" in data
    assert data["total"] >= 2

    # Filter by product_id
    r2 = await client.get(
        f"/api/v1/warehouse/inventories/{iid}/scan-events",
        params={"product_id": pid},
    )
    assert r2.status_code == 200, r2.text
    data2 = r2.json()
    assert data2["total"] >= 2
    for item in data2["items"]:
        assert str(item["product_id"]) == pid
        assert "qty" in item
        assert "scanned_by" in item
        assert "scanned_at" in item
        assert "is_voided" in item


# ---------------------------------------------------------------------------
# Test: GET progress endpoint
# ---------------------------------------------------------------------------

async def test_progress_endpoint_correct_counts(client: httpx.AsyncClient):
    """GET progress returns correct total_products, scanned_products, total_scans, scanners."""
    wh_id = await _ensure_warehouse(client, "T205-WH-Progress")
    pid1 = await _ensure_product(client, "T205-Product-Progress1")
    pid2 = await _ensure_product(client, "T205-Product-Progress2")

    # Create inventory with 2 products
    r = await client.post("/api/v1/warehouse/inventories", json={
        "warehouse_id": wh_id,
        "blind_count": False,
        "items": [
            {"product_id": pid1, "actual_qty": "0"},
            {"product_id": pid2, "actual_qty": "0"},
        ],
    })
    assert r.status_code == 201, r.text
    iid = r.json()["id"]
    await _start_inventory(client, iid)

    # Scan only pid1 (2 scans)
    await _scan(client, iid, pid1, "3")
    await _scan(client, iid, pid1, "2")

    r = await client.get(f"/api/v1/warehouse/inventories/{iid}/progress")
    assert r.status_code == 200, r.text
    prog = r.json()

    assert prog["total_products"] == 2, f"Expected 2 total, got {prog['total_products']}"
    assert prog["scanned_products"] == 1, f"Expected 1 scanned, got {prog['scanned_products']}"
    assert prog["total_scans"] == 2, f"Expected 2 total_scans, got {prog['total_scans']}"
    assert len(prog["scanners"]) >= 1
    assert prog["last_scan_at"] is not None

    scanner = prog["scanners"][0]
    assert "user_id" in scanner
    assert "name" in scanner
    assert scanner["scan_count"] == 2


# ---------------------------------------------------------------------------
# Test: voided events excluded from progress counts
# ---------------------------------------------------------------------------

async def test_voided_events_excluded_from_progress(client: httpx.AsyncClient):
    """Voided scan events are not counted in progress stats."""
    wh_id = await _ensure_warehouse(client, "T205-WH-VoidProg")
    pid = await _ensure_product(client, "T205-Product-VoidProg")

    iid = await _create_inventory(client, wh_id, pid, "0")
    await _start_inventory(client, iid)

    r1 = await _scan(client, iid, pid, "10")
    event_id = r1["scan_event_id"]
    await _scan(client, iid, pid, "5")

    # Void the first event
    del_r = await client.delete(f"/api/v1/warehouse/inventories/{iid}/scan-events/{event_id}")
    assert del_r.status_code == 200

    # Progress should show only 1 non-voided scan
    r = await client.get(f"/api/v1/warehouse/inventories/{iid}/progress")
    assert r.status_code == 200, r.text
    prog = r.json()
    assert prog["total_scans"] == 1, f"Expected 1 after void, got {prog['total_scans']}"
    assert prog["scanned_products"] == 1


# ---------------------------------------------------------------------------
# Test: blind_count hides expected_qty (regression from T-204)
# ---------------------------------------------------------------------------

async def test_blind_count_regression(client: httpx.AsyncClient):
    """Regression: blind_count=True hides expected_qty even after scan events added."""
    wh_id = await _ensure_warehouse(client, "T205-WH-BlindReg")
    pid = await _ensure_product(client, "T205-Product-BlindReg")

    iid = await _create_inventory(client, wh_id, pid, "0", blind_count=True)
    await _start_inventory(client, iid)

    await _scan(client, iid, pid, "7")

    r = await client.get(f"/api/v1/warehouse/inventories/{iid}/items")
    assert r.status_code == 200, r.text
    items = r.json()
    for item in items:
        assert item["expected_qty"] is None, (
            f"blind_count: expected_qty must be null, got {item['expected_qty']}"
        )
        assert float(item["actual_qty"]) == 7.0
