"""
T-206 — cashboxes.warehouse_id + POS↔warehouse binding.

Tests run against the live API (same pattern as other integration tests).
Requires ANIQ demo seed: at least one warehouse + one currency.

Test matrix:
  1. POST /finance/cashboxes with warehouse_id — stored and returned in GET
  2. GET /finance/cashboxes — warehouse_name visible when bound
  3. PUT /finance/cashboxes/{id} — warehouse_id updatable
  4. POST /sale/sales with cashbox_id only → warehouse auto-resolved
  5. POST /sale/sales with cashbox_id whose warehouse_id is NULL → 422
  6. POST /sale/sales with neither warehouse_id nor cashbox_id → 422
  7. POST /sale/sales with warehouse_id override when cashbox also provided
     → accepted (QA user has admin/manager role → has sale.change_warehouse)
  8. Cross-org warehouse_id on cashbox create → 422
"""
import pytest
import httpx


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

async def _seed(client: httpx.AsyncClient):
    """Return (warehouse_id, currency_id) from demo seed."""
    wh_resp = await client.get("/api/v1/warehouse/warehouses")
    assert wh_resp.status_code == 200
    warehouses = wh_resp.json()
    assert warehouses, "Demo seed must have at least one warehouse"
    wh_id = warehouses[0]["id"]

    cur_resp = await client.get("/api/v1/reference/currencies")
    currencies = cur_resp.json() if cur_resp.status_code == 200 else []
    cur_id = currencies[0]["id"] if currencies else 1

    return wh_id, cur_id


async def _get_product_id(client: httpx.AsyncClient):
    pr_resp = await client.get("/api/v1/warehouse/products?limit=1")
    assert pr_resp.status_code == 200
    products = pr_resp.json()
    assert products, "Demo seed must have at least one product"
    return products[0]["id"]


async def _ensure_stock(client: httpx.AsyncClient, wh_id: int, product_id: str, qty: str = "50") -> None:
    """Ensure product has sufficient stock so negative-guard does not block sale tests."""
    r = await client.post("/api/v1/warehouse/inventories", json={
        "warehouse_id": wh_id,
        "items": [{"product_id": product_id, "actual_qty": qty}],
    })
    assert r.status_code in (200, 201), f"inv create: {r.text}"
    iid = r.json()["id"]
    r = await client.post(f"/api/v1/warehouse/inventories/{iid}/finish")
    assert r.status_code == 200, f"inv finish: {r.text}"


async def _create_cashbox(client: httpx.AsyncClient, currency_id: int, warehouse_id=None, name="Test CB T206") -> int:
    payload = {"name": name, "currency_id": currency_id}
    if warehouse_id is not None:
        payload["warehouse_id"] = warehouse_id
    resp = await client.post("/api/v1/finance/cashboxes", json=payload)
    assert resp.status_code == 201, f"cashbox create failed: {resp.text}"
    return resp.json()["id"]


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_cashbox_create_with_warehouse_id(client):
    """POST /finance/cashboxes with warehouse_id stores and returns it."""
    wh_id, cur_id = await _seed(client)
    cb_id = await _create_cashbox(client, cur_id, warehouse_id=wh_id, name="T206-create")

    list_resp = await client.get("/api/v1/finance/cashboxes")
    assert list_resp.status_code == 200
    boxes = list_resp.json()
    matching = [b for b in boxes if b["id"] == cb_id]
    assert matching, "Created cashbox not found in list"
    cb = matching[0]
    assert cb["warehouse_id"] == wh_id
    assert cb["warehouse_name"] is not None


@pytest.mark.asyncio
async def test_cashbox_create_without_warehouse(client):
    """POST /finance/cashboxes without warehouse_id — warehouse_id is NULL."""
    _, cur_id = await _seed(client)
    cb_id = await _create_cashbox(client, cur_id, warehouse_id=None, name="T206-no-wh")

    list_resp = await client.get("/api/v1/finance/cashboxes")
    boxes = list_resp.json()
    matching = [b for b in boxes if b["id"] == cb_id]
    assert matching
    assert matching[0]["warehouse_id"] is None


@pytest.mark.asyncio
async def test_cashbox_update_warehouse_id(client):
    """PUT /finance/cashboxes/{id} updates warehouse_id."""
    wh_id, cur_id = await _seed(client)
    cb_id = await _create_cashbox(client, cur_id, warehouse_id=None, name="T206-update")

    put_resp = await client.put(
        f"/api/v1/finance/cashboxes/{cb_id}",
        json={"name": "T206-update", "currency_id": cur_id, "warehouse_id": wh_id},
    )
    assert put_resp.status_code == 200

    list_resp = await client.get("/api/v1/finance/cashboxes")
    boxes = list_resp.json()
    matching = [b for b in boxes if b["id"] == cb_id]
    assert matching[0]["warehouse_id"] == wh_id


@pytest.mark.asyncio
async def test_sale_create_warehouse_auto_resolved_from_cashbox(client):
    """POST /sale/sales with cashbox_id (no warehouse_id) — warehouse resolved automatically."""
    wh_id, cur_id = await _seed(client)
    product_id = await _get_product_id(client)
    await _ensure_stock(client, wh_id, product_id)
    cb_id = await _create_cashbox(client, cur_id, warehouse_id=wh_id, name="T206-pos-cb")

    resp = await client.post(
        "/api/v1/sale/sales",
        json={
            "cashbox_id": cb_id,
            "currency_id": cur_id,
            "items": [{"product_id": product_id, "quantity": 1, "price": 1000, "discount": 0}],
        },
    )
    assert resp.status_code == 201, f"sale create failed: {resp.text}"
    sale_id = resp.json()["id"]

    # Verify warehouse_id is the cashbox's warehouse
    get_resp = await client.get(f"/api/v1/sale/sales/{sale_id}")
    assert get_resp.status_code == 200
    head = get_resp.json()["head"]
    assert head["warehouse_id"] == wh_id


@pytest.mark.asyncio
async def test_sale_create_cashbox_no_warehouse_422(client):
    """POST /sale/sales with cashbox that has no warehouse_id → 422."""
    _, cur_id = await _seed(client)
    product_id = await _get_product_id(client)
    cb_id = await _create_cashbox(client, cur_id, warehouse_id=None, name="T206-cb-no-wh")

    resp = await client.post(
        "/api/v1/sale/sales",
        json={
            "cashbox_id": cb_id,
            "currency_id": cur_id,
            "items": [{"product_id": product_id, "quantity": 1, "price": 1000, "discount": 0}],
        },
    )
    assert resp.status_code == 422
    assert "omborga bog'lanmagan" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_sale_create_no_warehouse_no_cashbox_422(client):
    """POST /sale/sales with neither warehouse_id nor cashbox_id → 422."""
    _, cur_id = await _seed(client)
    product_id = await _get_product_id(client)

    resp = await client.post(
        "/api/v1/sale/sales",
        json={
            "currency_id": cur_id,
            "items": [{"product_id": product_id, "quantity": 1, "price": 1000, "discount": 0}],
        },
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_sale_create_warehouse_override_with_cashbox(client):
    """POST /sale/sales with both warehouse_id and cashbox_id.

    QA user is admin/manager and has sale.change_warehouse → accepted.
    """
    wh_id, cur_id = await _seed(client)
    product_id = await _get_product_id(client)
    await _ensure_stock(client, wh_id, product_id)
    cb_id = await _create_cashbox(client, cur_id, warehouse_id=wh_id, name="T206-override-cb")

    resp = await client.post(
        "/api/v1/sale/sales",
        json={
            "warehouse_id": wh_id,
            "cashbox_id": cb_id,
            "currency_id": cur_id,
            "items": [{"product_id": product_id, "quantity": 1, "price": 1000, "discount": 0}],
        },
    )
    # QA user has admin role → has sale.change_warehouse → 201
    assert resp.status_code == 201, f"expected 201 got {resp.status_code}: {resp.text}"


@pytest.mark.asyncio
async def test_cashbox_cross_org_warehouse_422(client, org_id):
    """POST /finance/cashboxes with warehouse from a different org → 422."""
    _, cur_id = await _seed(client)

    # Use an obviously non-existent warehouse id (large number)
    resp = await client.post(
        "/api/v1/finance/cashboxes",
        json={"name": "T206-cross-org", "currency_id": cur_id, "warehouse_id": 999999},
    )
    assert resp.status_code == 422
    assert "organization" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_legacy_sale_create_with_warehouse_id_only(client):
    """POST /sale/sales with only warehouse_id (legacy mode) still works."""
    wh_id, cur_id = await _seed(client)
    product_id = await _get_product_id(client)
    await _ensure_stock(client, wh_id, product_id)

    resp = await client.post(
        "/api/v1/sale/sales",
        json={
            "warehouse_id": wh_id,
            "currency_id": cur_id,
            "items": [{"product_id": product_id, "quantity": 1, "price": 500, "discount": 0}],
        },
    )
    assert resp.status_code == 201, f"legacy sale failed: {resp.text}"
