"""
Integration tests for T-004: Warehouse Types, Rows, Racks CRUD.

Requires a running API with a seeded QA org (see conftest.py).
Run inside the container:
    docker exec erp-api pytest apps/api/tests/test_warehouse_types_racks.py -v
"""
import secrets
import pytest
import pytest_asyncio
import httpx


pytestmark = pytest.mark.asyncio

_SUFFIX = secrets.token_hex(4)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def wh_url(path: str) -> str:
    return f"/api/v1/warehouse{path}"


# ---------------------------------------------------------------------------
# Warehouse Types
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_and_list_warehouse_type(client: httpx.AsyncClient):
    """Happy path: create a type, verify it appears in the list."""
    payload = {"name": f"Test Markaziy {_SUFFIX}", "code": "central"}
    resp = await client.post(wh_url("/types"), json=payload)
    assert resp.status_code == 201, resp.text
    type_id = resp.json()["id"]
    assert isinstance(type_id, int)

    resp2 = await client.get(wh_url("/types"))
    assert resp2.status_code == 200
    names = [t["name"] for t in resp2.json()]
    assert f"Test Markaziy {_SUFFIX}" in names

    found = next(t for t in resp2.json() if t["id"] == type_id)
    assert found["code"] == "central"
    assert found["is_active"] is True
    assert "created_at" in found

    # cleanup
    await client.delete(wh_url(f"/types/{type_id}"))


@pytest.mark.asyncio
async def test_create_type_invalid_code(client: httpx.AsyncClient):
    """code must match the allowed enum."""
    resp = await client.post(wh_url("/types"), json={"name": "Bad code", "code": "INVALID"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_type_null_code(client: httpx.AsyncClient):
    """code is optional (nullable)."""
    resp = await client.post(wh_url("/types"), json={"name": f"No-code type {_SUFFIX}"})
    assert resp.status_code == 201
    type_id = resp.json()["id"]
    # cleanup
    await client.delete(wh_url(f"/types/{type_id}"))


@pytest.mark.asyncio
async def test_update_warehouse_type(client: httpx.AsyncClient):
    """PUT /warehouse/types/{id} returns ok:true and name is changed."""
    create = await client.post(wh_url("/types"), json={"name": f"UpdateMe {_SUFFIX}", "code": "pos"})
    assert create.status_code == 201
    type_id = create.json()["id"]

    upd = await client.put(wh_url(f"/types/{type_id}"), json={"name": f"Updated {_SUFFIX}", "code": "transit"})
    assert upd.status_code == 200
    assert upd.json() == {"ok": True}

    lst = await client.get(wh_url("/types"))
    found = next((t for t in lst.json() if t["id"] == type_id), None)
    assert found is not None
    assert found["name"] == f"Updated {_SUFFIX}"

    # cleanup
    await client.delete(wh_url(f"/types/{type_id}"))


@pytest.mark.asyncio
async def test_delete_warehouse_type_soft(client: httpx.AsyncClient):
    """DELETE soft-deletes (is_active=FALSE); type disappears from list."""
    create = await client.post(wh_url("/types"), json={"name": f"DeleteMe {_SUFFIX}"})
    assert create.status_code == 201
    type_id = create.json()["id"]

    resp = await client.delete(wh_url(f"/types/{type_id}"))
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}

    lst = await client.get(wh_url("/types"))
    ids = [t["id"] for t in lst.json()]
    assert type_id not in ids


@pytest.mark.asyncio
async def test_update_type_404(client: httpx.AsyncClient):
    """PUT on non-existent type_id returns 404."""
    resp = await client.put(wh_url("/types/999999"), json={"name": "Ghost"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_warehouse_list_includes_type_fields(client: httpx.AsyncClient):
    """GET /warehouse/warehouses must return type_id and type_name fields."""
    resp = await client.get(wh_url("/warehouses"))
    assert resp.status_code == 200
    warehouses = resp.json()
    assert isinstance(warehouses, list)
    if warehouses:
        for wh in warehouses:
            assert "type_id" in wh
            assert "type_name" in wh


# ---------------------------------------------------------------------------
# Warehouse Rows
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def warehouse_id(client: httpx.AsyncClient) -> int:
    """Creates a temporary warehouse for row/rack tests, yields its id, deletes after."""
    resp = await client.post(wh_url("/warehouses"), json={"name": "T004 Test Warehouse"})
    assert resp.status_code == 201
    wid = resp.json()["id"]
    yield wid
    await client.delete(wh_url(f"/warehouses/{wid}"))


@pytest.mark.asyncio
async def test_create_and_list_row(client: httpx.AsyncClient, warehouse_id: int):
    """Happy path: create a row under a warehouse, list it."""
    resp = await client.post(wh_url(f"/{warehouse_id}/rows"), json={"name": "Qator A", "sort_order": 0})
    assert resp.status_code == 201
    row_id = resp.json()["id"]
    assert isinstance(row_id, int)

    lst = await client.get(wh_url(f"/{warehouse_id}/rows"))
    assert lst.status_code == 200
    rows = lst.json()
    assert any(r["id"] == row_id for r in rows)
    found = next(r for r in rows if r["id"] == row_id)
    assert found["name"] == "Qator A"
    assert found["warehouse_id"] == warehouse_id
    assert "rack_count" in found
    assert found["rack_count"] == 0


@pytest.mark.asyncio
async def test_row_404_wrong_org(client: httpx.AsyncClient):
    """Accessing rows of a warehouse that belongs to another org returns 404."""
    resp = await client.get(wh_url("/999999/rows"))
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_row(client: httpx.AsyncClient, warehouse_id: int):
    """PUT /warehouse/rows/{rid} updates name and sort_order."""
    create = await client.post(wh_url(f"/{warehouse_id}/rows"), json={"name": "B qator", "sort_order": 1})
    row_id = create.json()["id"]

    upd = await client.put(wh_url(f"/rows/{row_id}"), json={"name": "B qator (yangi)", "sort_order": 2})
    assert upd.status_code == 200
    assert upd.json() == {"ok": True}


@pytest.mark.asyncio
async def test_delete_row_with_racks_returns_409(client: httpx.AsyncClient, warehouse_id: int):
    """Deleting a row that has racks returns 409."""
    row_resp = await client.post(wh_url(f"/{warehouse_id}/rows"), json={"name": "Row with racks"})
    row_id = row_resp.json()["id"]

    rack_resp = await client.post(wh_url(f"/rows/{row_id}/racks"), json={"name": "A-1"})
    assert rack_resp.status_code == 201

    del_resp = await client.delete(wh_url(f"/rows/{row_id}"))
    assert del_resp.status_code == 409
    assert "stellaj" in del_resp.json()["detail"].lower()

    # cleanup: delete rack first, then row
    rack_id = rack_resp.json()["id"]
    await client.delete(wh_url(f"/racks/{rack_id}"))
    await client.delete(wh_url(f"/rows/{row_id}"))


@pytest.mark.asyncio
async def test_delete_row_without_racks(client: httpx.AsyncClient, warehouse_id: int):
    """Deleting an empty row succeeds with ok:true."""
    create = await client.post(wh_url(f"/{warehouse_id}/rows"), json={"name": "Empty row"})
    row_id = create.json()["id"]

    resp = await client.delete(wh_url(f"/rows/{row_id}"))
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


# ---------------------------------------------------------------------------
# Warehouse Racks
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def row_id(client: httpx.AsyncClient, warehouse_id: int) -> int:
    """Creates a row under the test warehouse, yields its id."""
    resp = await client.post(wh_url(f"/{warehouse_id}/rows"), json={"name": "Row for racks"})
    assert resp.status_code == 201
    rid = resp.json()["id"]
    yield rid
    # row may already be deleted by some tests; ignore errors
    await client.delete(wh_url(f"/rows/{rid}"))


@pytest.mark.asyncio
async def test_create_and_list_rack(client: httpx.AsyncClient, row_id: int):
    """Happy path: create a rack under a row, list it."""
    resp = await client.post(wh_url(f"/rows/{row_id}/racks"), json={"name": "A-1", "sort_order": 0})
    assert resp.status_code == 201
    rack_id = resp.json()["id"]

    lst = await client.get(wh_url(f"/rows/{row_id}/racks"))
    assert lst.status_code == 200
    racks = lst.json()
    assert any(r["id"] == rack_id for r in racks)
    found = next(r for r in racks if r["id"] == rack_id)
    assert found["name"] == "A-1"
    assert found["row_id"] == row_id

    # cleanup
    await client.delete(wh_url(f"/racks/{rack_id}"))


@pytest.mark.asyncio
async def test_update_rack(client: httpx.AsyncClient, row_id: int):
    """PUT /warehouse/racks/{rack_id} updates the rack."""
    create = await client.post(wh_url(f"/rows/{row_id}/racks"), json={"name": "B-2"})
    rack_id = create.json()["id"]

    upd = await client.put(wh_url(f"/racks/{rack_id}"), json={"name": "B-2 (yangilandi)", "sort_order": 5})
    assert upd.status_code == 200
    assert upd.json() == {"ok": True}

    # cleanup
    await client.delete(wh_url(f"/racks/{rack_id}"))


@pytest.mark.asyncio
async def test_delete_rack_no_products(client: httpx.AsyncClient, row_id: int):
    """Deleting an unlinked rack returns ok:true."""
    create = await client.post(wh_url(f"/rows/{row_id}/racks"), json={"name": "C-3"})
    rack_id = create.json()["id"]

    resp = await client.delete(wh_url(f"/racks/{rack_id}"))
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


@pytest.mark.asyncio
async def test_rack_list_wrong_row_404(client: httpx.AsyncClient):
    """Listing racks for a non-existent or wrong-org row returns 404."""
    resp = await client.get(wh_url("/rows/999999/racks"))
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_rack_count_in_row_list(client: httpx.AsyncClient, warehouse_id: int):
    """rack_count in row list reflects actual rack count."""
    row_resp = await client.post(wh_url(f"/{warehouse_id}/rows"), json={"name": "Count test row"})
    rid = row_resp.json()["id"]

    # create 2 racks
    r1 = (await client.post(wh_url(f"/rows/{rid}/racks"), json={"name": "R1"})).json()["id"]
    r2 = (await client.post(wh_url(f"/rows/{rid}/racks"), json={"name": "R2"})).json()["id"]

    lst = await client.get(wh_url(f"/{warehouse_id}/rows"))
    found = next(r for r in lst.json() if r["id"] == rid)
    assert found["rack_count"] == 2

    # cleanup
    await client.delete(wh_url(f"/racks/{r1}"))
    await client.delete(wh_url(f"/racks/{r2}"))
    await client.delete(wh_url(f"/rows/{rid}"))


# ---------------------------------------------------------------------------
# Org isolation
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_type_duplicate_name(client: httpx.AsyncClient):
    """POST same name twice → second call returns 409."""
    payload = {"name": f"DuplicateType-T011-{_SUFFIX}", "code": "custom"}
    r1 = await client.post(wh_url("/types"), json=payload)
    assert r1.status_code == 201, r1.text
    type_id = r1.json()["id"]

    r2 = await client.post(wh_url("/types"), json=payload)
    assert r2.status_code == 409, r2.text

    # cleanup
    await client.delete(wh_url(f"/types/{type_id}"))


@pytest.mark.asyncio
async def test_list_types_org_isolation(client: httpx.AsyncClient):
    """Types visible to correct org; a null-org client cannot see them."""
    unique_name = f"OrgIsoCheck-T011-{_SUFFIX}"
    create = await client.post(wh_url("/types"), json={"name": unique_name})
    assert create.status_code == 201
    type_id = create.json()["id"]

    # Same org — must be visible
    lst = await client.get(wh_url("/types"))
    assert lst.status_code == 200
    assert any(t["name"] == unique_name for t in lst.json())

    # Fake org — must NOT see the type (either 4xx or empty result)
    import httpx as _httpx
    async with _httpx.AsyncClient(base_url=client.base_url, timeout=10) as other:
        other.headers.update({
            "Authorization": client.headers.get("Authorization", ""),
            "X-Organization-Id": "00000000-0000-0000-0000-000000000001",
        })
        other_resp = await other.get(wh_url("/types"))
        if other_resp.status_code == 200:
            assert not any(t["name"] == unique_name for t in other_resp.json())

    # cleanup
    await client.delete(wh_url(f"/types/{type_id}"))


@pytest.mark.asyncio
async def test_org_isolation_types(client: httpx.AsyncClient):
    """Types created by org A must not bleed into another org's list.
    This test uses a second token-less client hitting the same endpoint — verifies
    that the list endpoint scopes by org_id header."""
    # Create a type that has a unique name
    unique_name = f"OrgIsolation-Type-T004-{_SUFFIX}"
    create = await client.post(wh_url("/types"), json={"name": unique_name, "code": "scrap"})
    assert create.status_code == 201
    type_id = create.json()["id"]

    # Same client (same org) should see it
    lst = await client.get(wh_url("/types"))
    assert any(t["name"] == unique_name for t in lst.json())

    # Request with a fake org header should NOT see it (different org scope)
    import httpx as _httpx
    async with _httpx.AsyncClient(base_url=client.base_url, timeout=10) as other:
        other.headers.update({
            "Authorization": client.headers.get("Authorization", ""),
            "X-Organization-Id": "00000000-0000-0000-0000-000000000000",
        })
        other_resp = await other.get(wh_url("/types"))
        # Either 401/403 (invalid org) or empty list — the unique name must not appear
        if other_resp.status_code == 200:
            assert not any(t["name"] == unique_name for t in other_resp.json())

    # cleanup
    await client.delete(wh_url(f"/types/{type_id}"))
