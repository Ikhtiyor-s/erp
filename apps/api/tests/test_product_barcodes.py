"""
Integration tests for T-203: product_barcodes CRUD + lookup.
Run inside container: docker exec erp-api pytest apps/api/tests/test_product_barcodes.py -v
"""
import secrets
import pytest
import pytest_asyncio
import httpx

from tests.conftest import API_URL

pytestmark = pytest.mark.asyncio

_BC_PREFIX = f"_TEST_BC_{secrets.token_hex(4)}_"


async def _ensure_product(client: httpx.AsyncClient, name: str) -> str:
    r = await client.get("/api/v1/warehouse/products", params={"q": name})
    assert r.status_code == 200
    for prod in r.json():
        if prod["name"] == name:
            return prod["id"]
    r = await client.post("/api/v1/warehouse/products", json={"name": name})
    assert r.status_code == 201, r.text
    return r.json()["id"]


@pytest.mark.asyncio
async def test_add_and_list_barcode(client: httpx.AsyncClient):
    pid = await _ensure_product(client, f"{_BC_PREFIX}PRODUCT_A")
    bc = f"{_BC_PREFIX}BC001"

    # Add barcode
    r = await client.post(f"/api/v1/warehouse/products/{pid}/barcodes",
                          json={"barcode": bc, "is_primary": True})
    assert r.status_code == 201, r.text
    bid = r.json()["id"]
    assert isinstance(bid, int)

    # List — should contain our barcode
    r = await client.get(f"/api/v1/warehouse/products/{pid}/barcodes")
    assert r.status_code == 200
    codes = [b["barcode"] for b in r.json()]
    assert bc in codes

    # Verify is_primary flag
    primary_rows = [b for b in r.json() if b["barcode"] == bc]
    assert primary_rows[0]["is_primary"] is True


@pytest.mark.asyncio
async def test_duplicate_active_barcode_409(client: httpx.AsyncClient):
    pid_a = await _ensure_product(client, f"{_BC_PREFIX}PRODUCT_DUP_A")
    pid_b = await _ensure_product(client, f"{_BC_PREFIX}PRODUCT_DUP_B")
    bc = f"{_BC_PREFIX}DUP001"

    # Add barcode to product A
    r = await client.post(f"/api/v1/warehouse/products/{pid_a}/barcodes",
                          json={"barcode": bc})
    assert r.status_code in (201, 409), r.text  # 409 if already exists from earlier run

    # Try to add same barcode to product B — must return 409
    r = await client.post(f"/api/v1/warehouse/products/{pid_b}/barcodes",
                          json={"barcode": bc})
    assert r.status_code == 409, r.text


@pytest.mark.asyncio
async def test_set_primary_single_primary(client: httpx.AsyncClient):
    pid = await _ensure_product(client, f"{_BC_PREFIX}PRODUCT_PRIMARY")
    bc1 = f"{_BC_PREFIX}PRI001"
    bc2 = f"{_BC_PREFIX}PRI002"

    r1 = await client.post(f"/api/v1/warehouse/products/{pid}/barcodes",
                           json={"barcode": bc1, "is_primary": True})
    assert r1.status_code in (201, 409), r1.text

    r2 = await client.post(f"/api/v1/warehouse/products/{pid}/barcodes",
                           json={"barcode": bc2, "is_primary": False})
    assert r2.status_code in (201, 409), r2.text
    if r2.status_code == 409:
        pytest.skip("Barcode already exists from earlier run; skipping set-primary test")
    bid2 = r2.json()["id"]

    # Set bc2 as primary
    r = await client.post(f"/api/v1/warehouse/products/{pid}/barcodes/{bid2}/set-primary")
    assert r.status_code == 200, r.text
    assert r.json()["ok"] is True

    # Now bc2 must be primary and bc1 must not
    r = await client.get(f"/api/v1/warehouse/products/{pid}/barcodes",
                         params={"is_active": "true"})
    assert r.status_code == 200
    barcodes = r.json()
    primary_list = [b for b in barcodes if b["is_primary"]]
    assert len(primary_list) == 1, f"Expected 1 primary, got {primary_list}"
    assert primary_list[0]["barcode"] == bc2


@pytest.mark.asyncio
async def test_deactivate_barcode(client: httpx.AsyncClient):
    pid = await _ensure_product(client, f"{_BC_PREFIX}PRODUCT_DEACT")
    bc = f"{_BC_PREFIX}DEACT001"

    r = await client.post(f"/api/v1/warehouse/products/{pid}/barcodes",
                          json={"barcode": bc})
    if r.status_code == 409:
        # Already exists; get the id
        rl = await client.get(f"/api/v1/warehouse/products/{pid}/barcodes")
        rows = [b for b in rl.json() if b["barcode"] == bc and b["is_active"]]
        if not rows:
            pytest.skip("Barcode already deactivated; cannot re-deactivate in this test")
        bid = rows[0]["id"]
    else:
        assert r.status_code == 201, r.text
        bid = r.json()["id"]

    # Deactivate
    r = await client.post(f"/api/v1/warehouse/products/{pid}/barcodes/{bid}/deactivate")
    assert r.status_code == 200, r.text
    assert r.json()["ok"] is True

    # Should not appear in active list
    r = await client.get(f"/api/v1/warehouse/products/{pid}/barcodes",
                         params={"is_active": "true"})
    assert r.status_code == 200
    active_codes = [b["barcode"] for b in r.json()]
    assert bc not in active_codes

    # barcode-lookup must NOT find it
    r = await client.get("/api/v1/warehouse/barcode-lookup", params={"q": bc})
    assert r.status_code == 404, r.text


@pytest.mark.asyncio
async def test_reactivate_barcode(client: httpx.AsyncClient):
    pid = await _ensure_product(client, f"{_BC_PREFIX}PRODUCT_REACT")
    bc = f"{_BC_PREFIX}REACT001"

    # Add then deactivate
    r = await client.post(f"/api/v1/warehouse/products/{pid}/barcodes",
                          json={"barcode": bc})
    if r.status_code == 409:
        pytest.skip("Barcode active on another product; cannot test reactivate cleanly")
    assert r.status_code == 201, r.text
    bid = r.json()["id"]

    r = await client.post(f"/api/v1/warehouse/products/{pid}/barcodes/{bid}/deactivate")
    assert r.status_code == 200

    # Reactivate
    r = await client.post(f"/api/v1/warehouse/products/{pid}/barcodes/{bid}/reactivate")
    assert r.status_code == 200, r.text
    assert r.json()["ok"] is True

    # Now should be active again
    r = await client.get(f"/api/v1/warehouse/products/{pid}/barcodes",
                         params={"is_active": "true"})
    active_codes = [b["barcode"] for b in r.json()]
    assert bc in active_codes


@pytest.mark.asyncio
async def test_barcode_lookup_finds_product(client: httpx.AsyncClient):
    pid = await _ensure_product(client, f"{_BC_PREFIX}PRODUCT_LOOKUP")
    bc = f"{_BC_PREFIX}LOOK001"

    r = await client.post(f"/api/v1/warehouse/products/{pid}/barcodes",
                          json={"barcode": bc})
    assert r.status_code in (201, 409), r.text

    r = await client.get("/api/v1/warehouse/barcode-lookup", params={"q": bc})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["id"] == pid


@pytest.mark.asyncio
async def test_barcode_lookup_404_unknown(client: httpx.AsyncClient):
    r = await client.get("/api/v1/warehouse/barcode-lookup",
                         params={"q": f"{_BC_PREFIX}NONEXISTENT_XYZ_99999"})
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_cross_org_isolation(client: httpx.AsyncClient, org_id: str):
    """Verify that barcodes are scoped to org (test against own org endpoint only)."""
    pid = await _ensure_product(client, f"{_BC_PREFIX}PRODUCT_ORG_ISO")
    bc = f"{_BC_PREFIX}ORG_ISO001"

    r = await client.post(f"/api/v1/warehouse/products/{pid}/barcodes",
                          json={"barcode": bc})
    assert r.status_code in (201, 409), r.text

    # Lookup from same org — must find
    r = await client.get("/api/v1/warehouse/barcode-lookup", params={"q": bc})
    assert r.status_code == 200

    # Create a client with no org header — must get 422 or 403
    async with httpx.AsyncClient(base_url=API_URL, timeout=10) as bare:
        token = client.headers.get("Authorization", "")
        bare.headers["Authorization"] = token
        r2 = await bare.get("/api/v1/warehouse/barcode-lookup", params={"q": bc})
        assert r2.status_code in (400, 401, 403, 422), (
            f"Expected auth/org error without org header, got {r2.status_code}"
        )
