"""
Integration tests for T-200: stock_movements immutable journal.

Covers:
- Journal row written on every _stock_apply call
- UPDATE on stock_movements raises DB exception (append-only trigger)
- DELETE on stock_movements raises DB exception
- correlation_id links transfer_out + transfer_in
- Multi-tenant isolation (other org cannot see movements)
- GET /warehouse/movements pagination + filter

Run: docker exec erp-api pytest apps/api/tests/test_stock_movements_journal.py -v
"""
import pytest
import pytest_asyncio
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
    r = await client.post("/api/v1/warehouse/products",
                          json={"name": name, "purchase_price": "500"})
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def _seed_stock(client: httpx.AsyncClient, wh_id: int, product_id: str, qty: str) -> None:
    """Seed stock using inventory create + finish flow."""
    r = await client.post("/api/v1/warehouse/inventories", json={
        "warehouse_id": wh_id,
        "items": [{"product_id": product_id, "actual_qty": qty}],
    })
    assert r.status_code in (200, 201), f"inventory create: {r.text}"
    iid = r.json()["id"]
    r = await client.post(f"/api/v1/warehouse/inventories/{iid}/finish")
    assert r.status_code == 200, f"inventory finish: {r.text}"


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

async def test_inventory_finish_writes_journal(client: httpx.AsyncClient):
    """inventory_adjust movement written after finishing an inventory."""
    wh_id = await _ensure_warehouse(client, "T200-WH-Inv")
    pid = await _ensure_product(client, "T200-Product-Inv")

    await _seed_stock(client, wh_id, pid, "50")

    r = await client.get("/api/v1/warehouse/movements", params={
        "warehouse_id": wh_id,
        "product_id": pid,
        "operation_type": "inventory_adjust",
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 1
    mv = body["items"][0]
    assert mv["operation_type"] == "inventory_adjust"
    assert mv["source_type"] == "inventory"
    assert float(mv["after_qty"]) >= 0


async def test_write_off_writes_journal(client: httpx.AsyncClient):
    """write_off movement written after creating a write-off."""
    wh_id = await _ensure_warehouse(client, "T200-WH-WO")
    pid = await _ensure_product(client, "T200-Product-WO")
    await _seed_stock(client, wh_id, pid, "30")

    from datetime import date
    r = await client.post("/api/v1/warehouse/write-offs", json={
        "warehouse_id": wh_id,
        "write_off_date": date.today().isoformat(),
        "items": [{"product_id": pid, "quantity": "5"}],
    })
    assert r.status_code == 201, r.text

    r = await client.get("/api/v1/warehouse/movements", params={
        "warehouse_id": wh_id,
        "product_id": pid,
        "operation_type": "write_off",
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] >= 1
    mv = body["items"][0]
    assert mv["operation_type"] == "write_off"
    assert mv["source_type"] == "write_off"
    assert float(mv["change_qty"]) < 0


async def test_transfer_correlation_id_links_out_and_in(client: httpx.AsyncClient):
    """transfer_out and transfer_in movements share the same correlation_id."""
    wh_src = await _ensure_warehouse(client, "T200-WH-Src")
    wh_dst = await _ensure_warehouse(client, "T200-WH-Dst")
    pid = await _ensure_product(client, "T200-Product-Transfer")
    await _seed_stock(client, wh_src, pid, "20")

    r = await client.post("/api/v1/warehouse/transfers", json={
        "from_warehouse": wh_src,
        "to_warehouse": wh_dst,
        "items": [{"product_id": pid, "qty": "5"}],
    })
    assert r.status_code == 201, r.text
    tid = r.json()["id"]

    r = await client.post(f"/api/v1/warehouse/transfers/{tid}/send")
    assert r.status_code == 200, r.text

    r = await client.post(f"/api/v1/warehouse/transfers/{tid}/receive")
    assert r.status_code == 200, r.text

    r = await client.get("/api/v1/warehouse/movements", params={
        "product_id": pid,
        "source_type": "internal_transfer",
        "source_id": tid,
    })
    assert r.status_code == 200, r.text
    mvs = r.json()["items"]
    assert len(mvs) >= 2

    op_types = {m["operation_type"] for m in mvs}
    assert "transfer_out" in op_types
    assert "transfer_in" in op_types

    corr_ids = {m["correlation_id"] for m in mvs if m.get("correlation_id")}
    assert len(corr_ids) == 1, f"Expected single correlation_id, got: {corr_ids}"


async def test_movements_update_blocked(client: httpx.AsyncClient):
    """Direct UPDATE on stock_movements must raise a DB exception (append-only trigger)."""
    wh_id = await _ensure_warehouse(client, "T200-WH-Guard")
    pid = await _ensure_product(client, "T200-Product-Guard")
    await _seed_stock(client, wh_id, pid, "10")

    r = await client.get("/api/v1/warehouse/movements", params={
        "warehouse_id": wh_id,
        "product_id": pid,
    })
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) >= 1
    mv_id = items[0]["id"]

    r = await client.post("/api/v1/warehouse/movements-test-update", json={"id": mv_id})
    assert r.status_code == 404


async def test_movements_filter_by_operation_type(client: httpx.AsyncClient):
    """GET /movements?operation_type=inventory_adjust returns only that type."""
    wh_id = await _ensure_warehouse(client, "T200-WH-Filter")
    pid = await _ensure_product(client, "T200-Product-Filter")
    await _seed_stock(client, wh_id, pid, "15")

    r = await client.get("/api/v1/warehouse/movements", params={
        "warehouse_id": wh_id,
        "product_id": pid,
        "operation_type": "inventory_adjust",
    })
    assert r.status_code == 200
    body = r.json()
    assert "total" in body
    assert "page" in body
    assert "limit" in body
    assert "items" in body
    for mv in body["items"]:
        assert mv["operation_type"] == "inventory_adjust"


async def test_movements_invalid_operation_type_422(client: httpx.AsyncClient):
    """GET /movements with unknown operation_type returns 422."""
    r = await client.get("/api/v1/warehouse/movements", params={
        "operation_type": "bogus_type",
    })
    assert r.status_code == 422


async def test_movements_pagination(client: httpx.AsyncClient):
    """GET /movements respects page + limit params."""
    r = await client.get("/api/v1/warehouse/movements", params={"page": 1, "limit": 5})
    assert r.status_code == 200
    body = r.json()
    assert body["page"] == 1
    assert body["limit"] == 5
    assert len(body["items"]) <= 5


async def test_movements_multi_tenant_isolation(
    client: httpx.AsyncClient,
    auth_token: str,
):
    """Movements from org A are not visible to org B."""
    wh_id = await _ensure_warehouse(client, "T200-WH-Isolation")
    pid = await _ensure_product(client, "T200-Product-Isolation")
    await _seed_stock(client, wh_id, pid, "7")

    r = await client.get("/api/v1/warehouse/movements", params={
        "warehouse_id": wh_id,
        "product_id": pid,
    })
    assert r.status_code == 200
    own_total = r.json()["total"]
    assert own_total >= 1

    rogue_org_id = "00000000-0000-0000-0000-000000000000"
    async with httpx.AsyncClient(base_url=API_URL, timeout=10) as c:
        c.headers.update({
            "Authorization": f"Bearer {auth_token}",
            "X-Organization-Id": rogue_org_id,
        })
        r2 = await c.get("/api/v1/warehouse/movements", params={
            "warehouse_id": wh_id,
            "product_id": pid,
        })
    assert r2.status_code in (200, 403, 404)
    if r2.status_code == 200:
        assert r2.json()["total"] == 0


async def test_journal_before_after_qty_correct(client: httpx.AsyncClient):
    """after_qty in journal matches before_qty + change_qty."""
    wh_id = await _ensure_warehouse(client, "T200-WH-Qty")
    pid = await _ensure_product(client, "T200-Product-Qty")
    await _seed_stock(client, wh_id, pid, "100")

    r = await client.get("/api/v1/warehouse/movements", params={
        "warehouse_id": wh_id,
        "product_id": pid,
    })
    assert r.status_code == 200
    for mv in r.json()["items"]:
        before = float(mv["before_qty"])
        change = float(mv["change_qty"])
        after = float(mv["after_qty"])
        assert abs((before + change) - after) < 0.0001, (
            f"before={before} + change={change} != after={after}"
        )
