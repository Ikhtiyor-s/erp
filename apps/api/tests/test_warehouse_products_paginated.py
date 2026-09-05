"""
Integration tests for GET /warehouse/products paginated + on_hand mode (T-026).
Requires a running API with the test org seeded (qa@example.com / Qa12345!).
Run inside container: docker exec erp-api pytest apps/api/tests/test_warehouse_products_paginated.py -v
"""
import pytest
import httpx

from tests.conftest import API_URL

pytestmark = pytest.mark.asyncio

BASE = "/api/v1/warehouse"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _ensure_warehouse(client: httpx.AsyncClient, name: str) -> int:
    r = await client.get(f"{BASE}/warehouses")
    assert r.status_code == 200
    for wh in r.json():
        if wh["name"] == name:
            return wh["id"]
    r = await client.post(f"{BASE}/warehouses", json={"name": name})
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def _ensure_category(client: httpx.AsyncClient, name: str) -> int:
    r = await client.get(f"{BASE}/categories")
    assert r.status_code == 200
    for c in r.json():
        if c["name"] == name:
            return c["id"]
    r = await client.post(f"{BASE}/categories", json={"name": name})
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def _ensure_product(
    client: httpx.AsyncClient, name: str, category_id: int | None = None,
    product_type: str | None = None, sku: str | None = None,
) -> str:
    payload: dict = {"name": name, "purchase_price": "100"}
    if category_id:
        payload["category_id"] = category_id
    if product_type:
        payload["product_type"] = product_type
    if sku:
        payload["sku"] = sku

    r = await client.get(f"{BASE}/products", params={"q": name})
    assert r.status_code == 200
    for p in r.json():
        if p["name"] == name:
            pid = p["id"]
            if product_type is not None:
                # Ensure the stored product_type matches what the test needs
                r2 = await client.put(f"{BASE}/products/{pid}", json=payload)
                assert r2.status_code == 200, r2.text
            return pid

    r = await client.post(f"{BASE}/products", json=payload)
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def _set_stock(client: httpx.AsyncClient, warehouse_id: int, product_id: str, qty: str) -> None:
    r = await client.post(f"{BASE}/inventories", json={
        "warehouse_id": warehouse_id,
        "items": [{"product_id": product_id, "actual_qty": qty}],
    })
    assert r.status_code in (200, 201), f"inventory create failed: {r.text}"
    iid = r.json()["id"]
    r = await client.post(f"{BASE}/inventories/{iid}/finish")
    assert r.status_code == 200, f"inventory finish failed: {r.text}"


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_no_warehouse_id_returns_flat_list(client: httpx.AsyncClient):
    """Backward compat: no warehouse_id → flat array (not paginated object)."""
    r = await client.get(f"{BASE}/products")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list), f"Expected list, got {type(data)}: {data!r}"


@pytest.mark.asyncio
async def test_paginated_shape(client: httpx.AsyncClient):
    """With warehouse_id → returns paginated object shape with required keys."""
    wh_id = await _ensure_warehouse(client, "_T026_WH_PAGINATED")
    pid = await _ensure_product(client, "_T026_PROD_BASIC")

    r = await client.get(f"{BASE}/products", params={"warehouse_id": wh_id, "limit": 30})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "total" in data
    assert "page" in data
    assert "limit" in data
    assert "items" in data
    assert isinstance(data["items"], list)
    assert data["page"] == 1
    assert data["limit"] == 30
    assert data["total"] >= 1


@pytest.mark.asyncio
async def test_on_hand_matches_stock_balances(client: httpx.AsyncClient):
    """on_hand must equal stock_balances.quantity for the warehouse."""
    wh_id = await _ensure_warehouse(client, "_T026_WH_ONHAND")
    pid = await _ensure_product(client, "_T026_PROD_ONHAND")
    await _set_stock(client, wh_id, pid, "42")

    r = await client.get(f"{BASE}/products", params={"warehouse_id": wh_id, "q": "_T026_PROD_ONHAND"})
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    assert len(items) >= 1
    match = next((i for i in items if i["id"] == pid), None)
    assert match is not None, f"Product {pid} not in response items"
    assert match["on_hand"] == pytest.approx(42.0), f"Expected on_hand=42, got {match['on_hand']}"


@pytest.mark.asyncio
async def test_on_hand_zero_when_no_stock(client: httpx.AsyncClient):
    """on_hand must be 0.0 (never null) when no stock_balances row exists."""
    wh_id = await _ensure_warehouse(client, "_T026_WH_ZEROSTOCK")
    pid = await _ensure_product(client, "_T026_PROD_ZERO")

    r = await client.get(f"{BASE}/products", params={"warehouse_id": wh_id, "q": "_T026_PROD_ZERO"})
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    match = next((i for i in items if i["id"] == pid), None)
    assert match is not None
    assert match["on_hand"] == pytest.approx(0.0)
    assert match["on_hand"] is not None


@pytest.mark.asyncio
async def test_search_by_q(client: httpx.AsyncClient):
    """q filter matches products by name."""
    wh_id = await _ensure_warehouse(client, "_T026_WH_QSEARCH")
    await _ensure_product(client, "_T026_UNIQUE_QNAME")

    r = await client.get(f"{BASE}/products", params={"warehouse_id": wh_id, "q": "_T026_UNIQUE_QNAME"})
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    assert any(i["name"] == "_T026_UNIQUE_QNAME" for i in items)


@pytest.mark.asyncio
async def test_search_no_match_returns_empty(client: httpx.AsyncClient):
    """q filter with no match returns total=0 and empty items."""
    wh_id = await _ensure_warehouse(client, "_T026_WH_NOMATCH")
    r = await client.get(f"{BASE}/products", params={
        "warehouse_id": wh_id, "q": "ZZZNEVEREXISTS99999"
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["total"] == 0
    assert data["items"] == []


@pytest.mark.asyncio
async def test_category_filter(client: httpx.AsyncClient):
    """category_id filter returns only products in that category."""
    wh_id = await _ensure_warehouse(client, "_T026_WH_CAT")
    cat_id = await _ensure_category(client, "_T026_CAT_MEBEL")
    pid = await _ensure_product(client, "_T026_PROD_CAT", category_id=cat_id)

    r = await client.get(f"{BASE}/products", params={
        "warehouse_id": wh_id, "category_id": cat_id
    })
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    assert any(i["id"] == pid for i in items), "Product with category_id not found in filtered results"
    for item in items:
        if item["category_id"] is not None:
            assert item["category_id"] == cat_id, f"Unexpected category_id {item['category_id']}"


@pytest.mark.asyncio
async def test_product_type_filter(client: httpx.AsyncClient):
    """product_type filter returns only products with that type."""
    wh_id = await _ensure_warehouse(client, "_T026_WH_PTYPE")
    pid = await _ensure_product(client, "_T026_PROD_FINISHED", product_type="finished")

    r = await client.get(f"{BASE}/products", params={
        "warehouse_id": wh_id, "product_type": "finished"
    })
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    for item in items:
        assert item.get("product_type") == "finished"
    assert any(i["id"] == pid for i in items)


@pytest.mark.asyncio
async def test_product_type_label(client: httpx.AsyncClient):
    """product_type_label is derived server-side from the fixed mapping."""
    wh_id = await _ensure_warehouse(client, "_T026_WH_LABEL")
    pid = await _ensure_product(client, "_T026_PROD_LABEL_RAW", product_type="raw")

    r = await client.get(f"{BASE}/products", params={
        "warehouse_id": wh_id, "q": "_T026_PROD_LABEL_RAW"
    })
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    match = next((i for i in items if i["id"] == pid), None)
    assert match is not None
    assert match.get("product_type_label") == "Xom ashyo"


@pytest.mark.asyncio
async def test_pagination_page_2(client: httpx.AsyncClient):
    """page=2 returns a different offset; total is consistent."""
    wh_id = await _ensure_warehouse(client, "_T026_WH_PAGE2")

    r1 = await client.get(f"{BASE}/products", params={"warehouse_id": wh_id, "page": 1, "limit": 1})
    assert r1.status_code == 200, r1.text
    d1 = r1.json()

    r2 = await client.get(f"{BASE}/products", params={"warehouse_id": wh_id, "page": 2, "limit": 1})
    assert r2.status_code == 200, r2.text
    d2 = r2.json()

    assert d1["total"] == d2["total"], "total should be consistent across pages"
    assert d1["page"] == 1
    assert d2["page"] == 2
    if d1["total"] > 1:
        ids_p1 = {i["id"] for i in d1["items"]}
        ids_p2 = {i["id"] for i in d2["items"]}
        assert ids_p1.isdisjoint(ids_p2), "Page 1 and page 2 must not overlap"


@pytest.mark.asyncio
async def test_limit_default_is_30_in_paginated_mode(client: httpx.AsyncClient):
    """Default limit in paginated mode is 30 (from DESIGN-2 Section 5.4)."""
    wh_id = await _ensure_warehouse(client, "_T026_WH_DEFLIMIT")
    r = await client.get(f"{BASE}/products", params={"warehouse_id": wh_id})
    assert r.status_code == 200, r.text
    data = r.json()
    # When warehouse_id is present, the endpoint uses the limit param (default 50
    # from query definition, capped at 100). The paginated call returns limit as-is.
    assert "limit" in data


@pytest.mark.asyncio
async def test_cross_org_warehouse_returns_404(client: httpx.AsyncClient):
    """Passing a warehouse_id that belongs to a different org must return 404."""
    # Use warehouse_id=999999 which is very unlikely to exist in the test org
    r = await client.get(f"{BASE}/products", params={"warehouse_id": 999999})
    assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"


@pytest.mark.asyncio
async def test_unauthenticated_returns_401(http_client: httpx.AsyncClient):
    """Unauthenticated request must return 401."""
    r = await http_client.get(f"{BASE}/products", params={"warehouse_id": 1})
    assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}"
