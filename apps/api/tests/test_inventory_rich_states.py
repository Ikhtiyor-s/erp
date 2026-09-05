"""
Integration tests for T-204: Inventory rich states + state machine.

State transitions tested:
  draft -> in_progress -> paused -> in_progress -> pending_confirmation -> completed
  Invalid transitions -> 422
  confirm -> stock_movements has inventory_adjust entries
  blind_count=True -> expected_qty is None in items response
  cancel from any non-completed state
  scan-events append actual_qty

Run: docker exec erp-api pytest apps/api/tests/test_inventory_rich_states.py -v
"""
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
    actual_qty: str = "10",
    blind_count: bool = False,
) -> str:
    r = await client.post("/api/v1/warehouse/inventories", json={
        "warehouse_id": wh_id,
        "blind_count": blind_count,
        "items": [{"product_id": product_id, "actual_qty": actual_qty}],
    })
    assert r.status_code == 201, f"create inventory: {r.text}"
    return r.json()["id"]


async def _seed_stock(client: httpx.AsyncClient, wh_id: int, product_id: str, qty: str) -> None:
    iid = await _create_inventory(client, wh_id, product_id, qty)
    r = await client.post(f"/api/v1/warehouse/inventories/{iid}/start")
    assert r.status_code == 200, r.text
    r = await client.post(f"/api/v1/warehouse/inventories/{iid}/submit")
    assert r.status_code == 200, r.text
    r = await client.post(f"/api/v1/warehouse/inventories/{iid}/confirm")
    assert r.status_code == 200, r.text


# ---------------------------------------------------------------------------
# Test: full state flow
# ---------------------------------------------------------------------------

async def test_full_state_flow(client: httpx.AsyncClient):
    """draft -> in_progress -> paused -> in_progress -> pending_confirmation -> completed"""
    wh_id = await _ensure_warehouse(client, "T204-WH-Flow")
    pid = await _ensure_product(client, "T204-Product-Flow")

    iid = await _create_inventory(client, wh_id, pid, "5")

    # Verify initial status is draft
    r = await client.get(f"/api/v1/warehouse/inventories/{iid}")
    assert r.status_code == 200
    head = r.json()["head"]
    assert head["status"] == "draft"

    # draft -> in_progress
    r = await client.post(f"/api/v1/warehouse/inventories/{iid}/start")
    assert r.status_code == 200, r.text
    assert r.json()["ok"] is True

    # in_progress -> paused
    r = await client.post(f"/api/v1/warehouse/inventories/{iid}/pause")
    assert r.status_code == 200, r.text

    # paused -> in_progress
    r = await client.post(f"/api/v1/warehouse/inventories/{iid}/resume")
    assert r.status_code == 200, r.text

    # in_progress -> pending_confirmation
    r = await client.post(f"/api/v1/warehouse/inventories/{iid}/submit")
    assert r.status_code == 200, r.text

    # pending_confirmation -> completed
    r = await client.post(f"/api/v1/warehouse/inventories/{iid}/confirm")
    assert r.status_code == 200, r.text

    # Verify final status
    r = await client.get(f"/api/v1/warehouse/inventories/{iid}")
    assert r.status_code == 200
    assert r.json()["head"]["status"] == "completed"


# ---------------------------------------------------------------------------
# Test: invalid transition returns 422
# ---------------------------------------------------------------------------

async def test_invalid_transition(client: httpx.AsyncClient):
    """paused -> completed directly must return 422."""
    wh_id = await _ensure_warehouse(client, "T204-WH-Invalid")
    pid = await _ensure_product(client, "T204-Product-Invalid")

    iid = await _create_inventory(client, wh_id, pid, "3")

    # Move to paused
    r = await client.post(f"/api/v1/warehouse/inventories/{iid}/start")
    assert r.status_code == 200
    r = await client.post(f"/api/v1/warehouse/inventories/{iid}/pause")
    assert r.status_code == 200

    # Try invalid: paused -> completed (skipping in_progress + pending_confirmation)
    r = await client.post(f"/api/v1/warehouse/inventories/{iid}/confirm")
    assert r.status_code == 422, f"Expected 422, got {r.status_code}: {r.text}"


async def test_invalid_transition_draft_to_completed(client: httpx.AsyncClient):
    """draft -> completed directly must return 422."""
    wh_id = await _ensure_warehouse(client, "T204-WH-Draft422")
    pid = await _ensure_product(client, "T204-Product-Draft422")

    iid = await _create_inventory(client, wh_id, pid, "1")

    r = await client.post(f"/api/v1/warehouse/inventories/{iid}/confirm")
    assert r.status_code == 422, f"Expected 422, got {r.status_code}: {r.text}"


# ---------------------------------------------------------------------------
# Test: confirm writes stock_movements with inventory_adjust
# ---------------------------------------------------------------------------

async def test_confirm_writes_stock_movements(client: httpx.AsyncClient):
    """confirm -> stock_movements has inventory_adjust entries for variance."""
    wh_id = await _ensure_warehouse(client, "T204-WH-Confirm")
    pid = await _ensure_product(client, "T204-Product-Confirm")

    # Seed 20 in stock
    await _seed_stock(client, wh_id, pid, "20")

    # Create inventory with actual_qty=25 (variance = +5)
    iid = await _create_inventory(client, wh_id, pid, "25")
    r = await client.post(f"/api/v1/warehouse/inventories/{iid}/start")
    assert r.status_code == 200
    r = await client.post(f"/api/v1/warehouse/inventories/{iid}/submit")
    assert r.status_code == 200
    r = await client.post(f"/api/v1/warehouse/inventories/{iid}/confirm")
    assert r.status_code == 200, r.text

    # Check stock_movements has inventory_adjust entry for this inventory
    r = await client.get("/api/v1/warehouse/movements", params={
        "warehouse_id": wh_id,
        "product_id": pid,
        "source_type": "inventory",
    })
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    inv_adj = [m for m in items if m["operation_type"] == "inventory_adjust"
               and m.get("source_id") == iid]
    assert len(inv_adj) >= 1, f"Expected inventory_adjust movements for {iid}, got: {items}"


# ---------------------------------------------------------------------------
# Test: blind_count hides expected_qty
# ---------------------------------------------------------------------------

async def test_blind_count_hides_expected_qty(client: httpx.AsyncClient):
    """blind_count=True -> items response has expected_qty = null."""
    wh_id = await _ensure_warehouse(client, "T204-WH-Blind")
    pid = await _ensure_product(client, "T204-Product-Blind")

    iid = await _create_inventory(client, wh_id, pid, "7", blind_count=True)

    r = await client.get(f"/api/v1/warehouse/inventories/{iid}/items")
    assert r.status_code == 200, r.text
    items = r.json()
    assert len(items) >= 1
    for item in items:
        assert item["expected_qty"] is None, f"expected_qty should be null for blind_count, got: {item}"


async def test_normal_count_shows_expected_qty(client: httpx.AsyncClient):
    """blind_count=False (default) -> items response shows expected_qty."""
    wh_id = await _ensure_warehouse(client, "T204-WH-Normal")
    pid = await _ensure_product(client, "T204-Product-Normal")

    iid = await _create_inventory(client, wh_id, pid, "9", blind_count=False)

    r = await client.get(f"/api/v1/warehouse/inventories/{iid}/items")
    assert r.status_code == 200, r.text
    items = r.json()
    assert len(items) >= 1
    for item in items:
        assert item["expected_qty"] is not None, f"expected_qty should be visible for normal count"


# ---------------------------------------------------------------------------
# Test: cancel from non-completed states
# ---------------------------------------------------------------------------

async def test_cancel_from_draft(client: httpx.AsyncClient):
    wh_id = await _ensure_warehouse(client, "T204-WH-CancelDraft")
    pid = await _ensure_product(client, "T204-Product-CancelDraft")
    iid = await _create_inventory(client, wh_id, pid, "2")

    r = await client.post(f"/api/v1/warehouse/inventories/{iid}/cancel")
    assert r.status_code == 200, r.text

    r = await client.get(f"/api/v1/warehouse/inventories/{iid}")
    assert r.json()["head"]["status"] == "cancelled"


async def test_cancel_from_in_progress(client: httpx.AsyncClient):
    wh_id = await _ensure_warehouse(client, "T204-WH-CancelInProg")
    pid = await _ensure_product(client, "T204-Product-CancelInProg")
    iid = await _create_inventory(client, wh_id, pid, "2")

    r = await client.post(f"/api/v1/warehouse/inventories/{iid}/start")
    assert r.status_code == 200
    r = await client.post(f"/api/v1/warehouse/inventories/{iid}/cancel")
    assert r.status_code == 200, r.text

    r = await client.get(f"/api/v1/warehouse/inventories/{iid}")
    assert r.json()["head"]["status"] == "cancelled"


async def test_cancel_from_completed_is_invalid(client: httpx.AsyncClient):
    """completed -> cancelled is not allowed."""
    wh_id = await _ensure_warehouse(client, "T204-WH-CancelComplete")
    pid = await _ensure_product(client, "T204-Product-CancelComplete")
    iid = await _create_inventory(client, wh_id, pid, "2")

    # Full flow to completed
    await client.post(f"/api/v1/warehouse/inventories/{iid}/start")
    await client.post(f"/api/v1/warehouse/inventories/{iid}/submit")
    await client.post(f"/api/v1/warehouse/inventories/{iid}/confirm")

    r = await client.post(f"/api/v1/warehouse/inventories/{iid}/cancel")
    assert r.status_code == 422, f"Expected 422, got {r.status_code}: {r.text}"


# ---------------------------------------------------------------------------
# Test: scan-events append actual_qty
# ---------------------------------------------------------------------------

async def test_scan_event_updates_actual_qty(client: httpx.AsyncClient):
    """POST scan-event increments actual_qty via SUM(events)."""
    wh_id = await _ensure_warehouse(client, "T204-WH-Scan")
    pid = await _ensure_product(client, "T204-Product-Scan")

    iid = await _create_inventory(client, wh_id, pid, "0")
    r = await client.post(f"/api/v1/warehouse/inventories/{iid}/start")
    assert r.status_code == 200

    # First scan
    r = await client.post(f"/api/v1/warehouse/inventories/{iid}/scan-events", json={
        "product_id": pid,
        "quantity": "5",
    })
    assert r.status_code == 201, r.text

    # Second scan (additive)
    r = await client.post(f"/api/v1/warehouse/inventories/{iid}/scan-events", json={
        "product_id": pid,
        "quantity": "3",
    })
    assert r.status_code == 201, r.text

    # Check items — actual_qty should be 8
    r = await client.get(f"/api/v1/warehouse/inventories/{iid}/items")
    assert r.status_code == 200, r.text
    items = r.json()
    product_item = next((i for i in items if str(i["product_id"]) == pid), None)
    assert product_item is not None
    assert float(product_item["actual_qty"]) == 8.0, f"Expected 8, got {product_item['actual_qty']}"


async def test_scan_event_in_wrong_status_rejected(client: httpx.AsyncClient):
    """Scanning when status is 'draft' must return 422."""
    wh_id = await _ensure_warehouse(client, "T204-WH-ScanDraft")
    pid = await _ensure_product(client, "T204-Product-ScanDraft")

    iid = await _create_inventory(client, wh_id, pid, "0")

    r = await client.post(f"/api/v1/warehouse/inventories/{iid}/scan-events", json={
        "product_id": pid,
        "quantity": "1",
    })
    assert r.status_code == 422, f"Expected 422, got {r.status_code}: {r.text}"


# ---------------------------------------------------------------------------
# Test: reject transitions pending_confirmation back to in_progress
# ---------------------------------------------------------------------------

async def test_reject_returns_to_in_progress(client: httpx.AsyncClient):
    wh_id = await _ensure_warehouse(client, "T204-WH-Reject")
    pid = await _ensure_product(client, "T204-Product-Reject")
    iid = await _create_inventory(client, wh_id, pid, "4")

    await client.post(f"/api/v1/warehouse/inventories/{iid}/start")
    await client.post(f"/api/v1/warehouse/inventories/{iid}/submit")

    r = await client.post(f"/api/v1/warehouse/inventories/{iid}/reject")
    assert r.status_code == 200, r.text

    r = await client.get(f"/api/v1/warehouse/inventories/{iid}")
    assert r.json()["head"]["status"] == "in_progress"


# ---------------------------------------------------------------------------
# Test: cross-org isolation (second org cannot see first org's inventory)
# ---------------------------------------------------------------------------

async def test_cross_org_isolation(client: httpx.AsyncClient):
    """Inventory created for org A cannot be accessed by a different org_id header."""
    wh_id = await _ensure_warehouse(client, "T204-WH-Isolation")
    pid = await _ensure_product(client, "T204-Product-Isolation")
    iid = await _create_inventory(client, wh_id, pid, "1")

    # Spoof a different org_id
    fake_org_id = "00000000-0000-0000-0000-000000000001"
    r = await client.get(
        f"/api/v1/warehouse/inventories/{iid}",
        headers={"X-Organization-Id": fake_org_id},
    )
    # Should be 401/403 (auth middleware will reject unknown org) or 404 (not found for that org)
    assert r.status_code in (401, 403, 404, 422), (
        f"Cross-org isolation failed: status={r.status_code}, body={r.text[:200]}"
    )
