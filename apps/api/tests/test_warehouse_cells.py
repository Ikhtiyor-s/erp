"""
Integration tests for T-024: Warehouse Cells CRUD + product default_cell_id.

Run inside container:
    docker exec erp-api pytest apps/api/tests/test_warehouse_cells.py -v
"""
import pytest
import pytest_asyncio
import httpx


pytestmark = pytest.mark.asyncio


def wh_url(path: str) -> str:
    return f"/api/v1/warehouse{path}"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def warehouse_id(client: httpx.AsyncClient) -> int:
    resp = await client.post(wh_url("/warehouses"), json={"name": "T024 Test Warehouse"})
    assert resp.status_code == 201
    wid = resp.json()["id"]
    yield wid
    await client.delete(wh_url(f"/warehouses/{wid}"))


@pytest_asyncio.fixture
async def row_id(client: httpx.AsyncClient, warehouse_id: int) -> int:
    resp = await client.post(wh_url(f"/{warehouse_id}/rows"), json={"name": "T024 Row"})
    assert resp.status_code == 201
    rid = resp.json()["id"]
    yield rid
    await client.delete(wh_url(f"/rows/{rid}"))


@pytest_asyncio.fixture
async def rack_id(client: httpx.AsyncClient, row_id: int) -> int:
    resp = await client.post(wh_url(f"/rows/{row_id}/racks"), json={"name": "T024 Rack"})
    assert resp.status_code == 201
    rid = resp.json()["id"]
    yield rid
    await client.delete(wh_url(f"/racks/{rid}"))


# ---------------------------------------------------------------------------
# Happy-path: list + create
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_and_list_cell(client: httpx.AsyncClient, rack_id: int):
    """POST cell → 201 with {id, code, is_active}; then GET list shows it."""
    resp = await client.post(wh_url(f"/racks/{rack_id}/cells"), json={"code": "A-1"})
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["code"] == "A-1"
    assert body["is_active"] is True
    cell_id = body["id"]

    lst = await client.get(wh_url(f"/racks/{rack_id}/cells"))
    assert lst.status_code == 200
    codes = [c["code"] for c in lst.json()]
    assert "A-1" in codes

    # cleanup
    await client.delete(wh_url(f"/racks/{rack_id}/cells/{cell_id}"))


# ---------------------------------------------------------------------------
# Duplicate code rejection
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_duplicate_code_returns_409(client: httpx.AsyncClient, rack_id: int):
    """Creating a cell with an already-used code returns 409."""
    resp1 = await client.post(wh_url(f"/racks/{rack_id}/cells"), json={"code": "B-1"})
    assert resp1.status_code == 201
    cell_id = resp1.json()["id"]

    resp2 = await client.post(wh_url(f"/racks/{rack_id}/cells"), json={"code": "B-1"})
    assert resp2.status_code == 409
    assert "allaqachon" in resp2.json()["detail"]

    # cleanup
    await client.delete(wh_url(f"/racks/{rack_id}/cells/{cell_id}"))


# ---------------------------------------------------------------------------
# PATCH (update)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_patch_cell_code_and_active(client: httpx.AsyncClient, rack_id: int):
    """PATCH updates code and is_active; code conflict on same rack returns 409."""
    c1 = (await client.post(wh_url(f"/racks/{rack_id}/cells"), json={"code": "C-1"})).json()["id"]
    c2 = (await client.post(wh_url(f"/racks/{rack_id}/cells"), json={"code": "C-2"})).json()["id"]

    # Rename C-1 → C-3 and deactivate
    upd = await client.patch(
        wh_url(f"/racks/{rack_id}/cells/{c1}"),
        json={"code": "C-3", "is_active": False},
    )
    assert upd.status_code == 200
    assert upd.json()["code"] == "C-3"
    assert upd.json()["is_active"] is False

    # Try to rename C-2 to already-existing C-3 → 409
    conflict = await client.patch(
        wh_url(f"/racks/{rack_id}/cells/{c2}"),
        json={"code": "C-3"},
    )
    assert conflict.status_code == 409

    # cleanup
    await client.delete(wh_url(f"/racks/{rack_id}/cells/{c1}"))
    await client.delete(wh_url(f"/racks/{rack_id}/cells/{c2}"))


# ---------------------------------------------------------------------------
# DELETE soft-delete
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_delete_cell_returns_204(client: httpx.AsyncClient, rack_id: int):
    """DELETE returns 204 and sets is_active=False (soft delete)."""
    resp = await client.post(wh_url(f"/racks/{rack_id}/cells"), json={"code": "D-1"})
    cell_id = resp.json()["id"]

    del_resp = await client.delete(wh_url(f"/racks/{rack_id}/cells/{cell_id}"))
    assert del_resp.status_code == 204

    # Cell still exists but is inactive
    lst = await client.get(wh_url(f"/racks/{rack_id}/cells"))
    match = next((c for c in lst.json() if c["id"] == cell_id), None)
    assert match is not None
    assert match["is_active"] is False


# ---------------------------------------------------------------------------
# 409 when product references cell on delete
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_delete_cell_conflict_when_product_linked(
    client: httpx.AsyncClient, rack_id: int
):
    """DELETE cell returns 409 Conflict when a product references it as default_cell_id."""
    cell_resp = await client.post(wh_url(f"/racks/{rack_id}/cells"), json={"code": "E-1"})
    assert cell_resp.status_code == 201
    cell_id = cell_resp.json()["id"]

    # Create product with this cell as default
    prod_resp = await client.post(
        wh_url("/products"),
        json={"name": "T024 Linked Product", "default_cell_id": cell_id},
    )
    assert prod_resp.status_code == 201
    prod_id = prod_resp.json()["id"]

    # Attempt to delete cell → 409
    del_resp = await client.delete(wh_url(f"/racks/{rack_id}/cells/{cell_id}"))
    assert del_resp.status_code == 409
    assert "mahsulot" in del_resp.json()["detail"].lower()

    # cleanup: unlink product then delete cell
    await client.put(wh_url(f"/products/{prod_id}"), json={"name": "T024 Linked Product", "default_cell_id": None})
    await client.delete(wh_url(f"/racks/{rack_id}/cells/{cell_id}"))
    await client.delete(wh_url(f"/products/{prod_id}"))


# ---------------------------------------------------------------------------
# 404 for wrong rack (rack isolation)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_cell_list_wrong_rack_404(client: httpx.AsyncClient):
    """GET cells for non-existent rack returns 404."""
    resp = await client.get(wh_url("/racks/999999/cells"))
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Cross-org isolation
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_cell_org_isolation(client: httpx.AsyncClient, rack_id: int):
    """Cell created in org A must not appear to org B (fake org header)."""
    resp = await client.post(wh_url(f"/racks/{rack_id}/cells"), json={"code": "F-1"})
    assert resp.status_code == 201
    cell_id = resp.json()["id"]

    async with httpx.AsyncClient(base_url=client.base_url, timeout=10) as other:
        other.headers.update({
            "Authorization": client.headers.get("Authorization", ""),
            "X-Organization-Id": "00000000-0000-0000-0000-000000000001",
        })
        other_resp = await other.get(wh_url(f"/racks/{rack_id}/cells"))
        # Either 4xx (rack not in this org) or empty list
        if other_resp.status_code == 200:
            assert not any(c["id"] == cell_id for c in other_resp.json())

    # cleanup
    await client.delete(wh_url(f"/racks/{rack_id}/cells/{cell_id}"))


# ---------------------------------------------------------------------------
# Product list includes default_cell_id + default_cell_code
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_product_list_includes_cell_fields(client: httpx.AsyncClient, rack_id: int):
    """GET /products list must include default_cell_id and default_cell_code columns."""
    cell_resp = await client.post(wh_url(f"/racks/{rack_id}/cells"), json={"code": "G-1"})
    cell_id = cell_resp.json()["id"]

    prod_resp = await client.post(
        wh_url("/products"),
        json={"name": "T024 Cell Product", "default_cell_id": cell_id},
    )
    assert prod_resp.status_code == 201
    prod_id = prod_resp.json()["id"]

    lst = await client.get(wh_url("/products"), params={"q": "T024 Cell Product"})
    assert lst.status_code == 200
    match = next((p for p in lst.json() if p["id"] == prod_id), None)
    assert match is not None
    assert match["default_cell_id"] == cell_id
    assert match["default_cell_code"] == "G-1"

    # cleanup
    await client.put(wh_url(f"/products/{prod_id}"), json={"name": "T024 Cell Product", "default_cell_id": None})
    await client.delete(wh_url(f"/racks/{rack_id}/cells/{cell_id}"))
    await client.delete(wh_url(f"/products/{prod_id}"))


# ---------------------------------------------------------------------------
# Product update: invalid cell_id (wrong org) returns 422
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_product_update_invalid_cell_422(client: httpx.AsyncClient):
    """PUT product with default_cell_id from another org returns 422."""
    prod_resp = await client.post(
        wh_url("/products"),
        json={"name": "T024 Org Check Product"},
    )
    assert prod_resp.status_code == 201
    prod_id = prod_resp.json()["id"]

    fake_cell_id = "00000000-0000-0000-0000-000000000099"
    upd = await client.put(
        wh_url(f"/products/{prod_id}"),
        json={"name": "T024 Org Check Product", "default_cell_id": fake_cell_id},
    )
    assert upd.status_code == 422

    # cleanup
    await client.delete(wh_url(f"/products/{prod_id}"))
