"""
T-209: products.is_archived + default_supplier_id integration tests.

Runs against a live API (see conftest.py for env vars).
Requires a QA user with admin/manager role (warehouse.product.archive permission).
"""
import pytest
import pytest_asyncio
import httpx

from .conftest import API_URL


# -----------------------------------------------------------------------
# helpers
# -----------------------------------------------------------------------

async def _create_product(client: httpx.AsyncClient, name: str) -> str:
    resp = await client.post(
        "/api/v1/warehouse/products",
        json={"name": name, "purchase_price": "10.00", "sale_price": "15.00"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _get_product(client: httpx.AsyncClient, pid: str) -> dict:
    resp = await client.get(f"/api/v1/warehouse/products/{pid}/full")
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _list_products(client: httpx.AsyncClient, **params) -> list:
    resp = await client.get("/api/v1/warehouse/products", params=params)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    if isinstance(data, list):
        return data
    return data.get("items", [])


# -----------------------------------------------------------------------
# tests
# -----------------------------------------------------------------------

@pytest.mark.asyncio
async def test_archive_flow(client: httpx.AsyncClient):
    """Archive → invisible in default list → visible with include_archived=true."""
    pid = await _create_product(client, "T209_Archive_Flow_Product")

    # Default list should include it (not archived yet)
    products = await _list_products(client)
    ids = [p["id"] for p in products]
    assert pid in ids, "Newly created product should appear in default list"

    # Archive it
    resp = await client.post(f"/api/v1/warehouse/products/{pid}/archive")
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"ok": True}

    # Should NOT appear in default list
    products = await _list_products(client)
    ids = [p["id"] for p in products]
    assert pid not in ids, "Archived product must not appear in default list"

    # Should appear with include_archived=true
    products = await _list_products(client, include_archived="true")
    ids = [p["id"] for p in products]
    assert pid in ids, "Archived product must appear with include_archived=true"


@pytest.mark.asyncio
async def test_unarchive_flow(client: httpx.AsyncClient):
    """Archive then unarchive → product returns to default list."""
    pid = await _create_product(client, "T209_Unarchive_Flow_Product")

    await client.post(f"/api/v1/warehouse/products/{pid}/archive")

    # Unarchive
    resp = await client.post(f"/api/v1/warehouse/products/{pid}/unarchive")
    assert resp.status_code == 200, resp.text

    # Should be visible again
    products = await _list_products(client)
    ids = [p["id"] for p in products]
    assert pid in ids, "Unarchived product must reappear in default list"

    # is_archived flag should be False
    product = await _get_product(client, pid)
    assert product["is_archived"] is False
    assert product["archived_at"] is None


@pytest.mark.asyncio
async def test_archived_flag_in_full_response(client: httpx.AsyncClient):
    """GET /products/{id}/full must include is_archived and archived_at after archive."""
    pid = await _create_product(client, "T209_Full_Response_Test")

    # Not archived yet
    product = await _get_product(client, pid)
    assert product["is_archived"] is False

    # Archive
    await client.post(f"/api/v1/warehouse/products/{pid}/archive")
    product = await _get_product(client, pid)
    assert product["is_archived"] is True
    assert product["archived_at"] is not None

    # Cleanup
    await client.post(f"/api/v1/warehouse/products/{pid}/unarchive")


@pytest.mark.asyncio
async def test_archive_nonexistent_returns_404(client: httpx.AsyncClient):
    """Archiving a product UUID that doesn't exist returns 404."""
    fake_id = "00000000-0000-0000-0000-000000000001"
    resp = await client.post(f"/api/v1/warehouse/products/{fake_id}/archive")
    assert resp.status_code == 404, resp.text


@pytest.mark.asyncio
async def test_default_supplier_id_patch_and_get(client: httpx.AsyncClient):
    """PATCH default_supplier_id, then GET full returns it."""
    pid = await _create_product(client, "T209_DefaultSupplier_Test")

    # Get a supplier id from the org (if none exist, skip with a note)
    sup_resp = await client.get("/api/v1/supplier/suppliers")
    if sup_resp.status_code != 200 or not sup_resp.json():
        pytest.skip("No suppliers found in test org — skip default_supplier_id test")

    supplier_id = sup_resp.json()[0]["id"]

    # PATCH default_supplier_id
    resp = await client.patch(
        f"/api/v1/warehouse/products/{pid}",
        json={"default_supplier_id": supplier_id},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"ok": True}

    # GET full and verify
    product = await _get_product(client, pid)
    assert product["default_supplier_id"] == supplier_id
    assert product["default_supplier_name"] is not None


@pytest.mark.asyncio
async def test_default_supplier_id_in_create_and_put(client: httpx.AsyncClient):
    """POST and PUT /products accept default_supplier_id."""
    sup_resp = await client.get("/api/v1/supplier/suppliers")
    if sup_resp.status_code != 200 or not sup_resp.json():
        pytest.skip("No suppliers found in test org — skip")

    supplier_id = sup_resp.json()[0]["id"]

    # Create with default_supplier_id
    resp = await client.post(
        "/api/v1/warehouse/products",
        json={
            "name": "T209_Create_WithSupplier",
            "purchase_price": "5.00",
            "sale_price": "10.00",
            "default_supplier_id": supplier_id,
        },
    )
    assert resp.status_code == 201, resp.text
    pid = resp.json()["id"]

    product = await _get_product(client, pid)
    assert product["default_supplier_id"] == supplier_id

    # PUT clears it when set to None (via full update without supplier)
    put_resp = await client.put(
        f"/api/v1/warehouse/products/{pid}",
        json={
            "name": "T209_Create_WithSupplier",
            "purchase_price": "5.00",
            "sale_price": "10.00",
            "default_supplier_id": None,
        },
    )
    assert put_resp.status_code == 200, put_resp.text

    product = await _get_product(client, pid)
    assert product["default_supplier_id"] is None


@pytest.mark.asyncio
async def test_double_archive_is_idempotent(client: httpx.AsyncClient):
    """Archiving an already-archived product returns 200 ok."""
    pid = await _create_product(client, "T209_DoubleArchive_Test")
    await client.post(f"/api/v1/warehouse/products/{pid}/archive")
    resp = await client.post(f"/api/v1/warehouse/products/{pid}/archive")
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"ok": True}
    # Cleanup
    await client.post(f"/api/v1/warehouse/products/{pid}/unarchive")
