"""MXIK field tests for /api/v1/warehouse/products.

Covers:
 - Valid MXIK values (10-digit, 17-digit)
 - Null/absent MXIK (nullable field)
 - Invalid MXIK values (422 expected)
 - Update MXIK via PUT
 - Cross-tenant isolation (Org B product not visible from Org A token)
"""
import asyncio
import uuid
import pytest
import pytest_asyncio
import httpx

from tests.conftest import API_URL


# ---------------------------------------------------------------------------
# Sync helper — runs outside pytest's async machinery to avoid event_loop
# scope conflicts. Used for session-scoped fixture setup.
# ---------------------------------------------------------------------------

def _register_new_org_sync(suffix: str) -> tuple[str, str]:
    """Register a new user+org synchronously. Returns (access_token, org_id).

    Uses asyncio.run() so this can be called from a synchronous fixture.
    The @example.com domain passes Pydantic EmailStr validation.
    """
    async def _inner() -> tuple[str, str]:
        unique = str(uuid.uuid4())[:8]
        email = f"mxik_{suffix}_{unique}@example.com"
        async with httpx.AsyncClient(base_url=API_URL, timeout=15) as c:
            reg = await c.post(
                "/api/v1/auth/register",
                json={
                    "email": email,
                    "password": "Test1234!",
                    "full_name": f"MXIK Tester {suffix}",
                    "organization_name": f"MXIK Org {suffix} {unique}",
                },
            )
            assert reg.status_code == 201, f"Register failed ({suffix}): {reg.text}"
            token = reg.json()["access_token"]

            org_resp = await c.get(
                "/api/v1/organizations/mine",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert org_resp.status_code == 200, (
                f"/organizations/mine failed: {org_resp.text}"
            )
            orgs = org_resp.json()
            assert orgs, "Newly registered user must belong to at least one org"
            return token, orgs[0]["id"]

    return asyncio.run(_inner())


# ---------------------------------------------------------------------------
# Session-scoped synchronous fixtures — register ONCE per test session.
# Using sync fixtures avoids the event_loop scope mismatch in pytest-asyncio.
# The 5/hour rate-limit on /register makes it essential to minimise calls.
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def org_a_creds() -> tuple[str, str]:
    """(access_token, org_id) for Org A — registered once per session."""
    return _register_new_org_sync("orgA")


@pytest.fixture(scope="session")
def org_b_creds() -> tuple[str, str]:
    """(access_token, org_id) for Org B — registered once per session."""
    return _register_new_org_sync("orgB")


# ---------------------------------------------------------------------------
# Function-scoped async clients — built from session creds each test.
# A new AsyncClient per test function ensures no cross-test state leakage.
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def org_a_client(org_a_creds):
    token, org_id = org_a_creds
    async with httpx.AsyncClient(
        base_url=API_URL,
        timeout=15,
        headers={
            "Authorization": f"Bearer {token}",
            "X-Organization-Id": org_id,
        },
    ) as c:
        yield c


@pytest_asyncio.fixture
async def org_b_client(org_b_creds):
    token, org_id = org_b_creds
    async with httpx.AsyncClient(
        base_url=API_URL,
        timeout=15,
        headers={
            "Authorization": f"Bearer {token}",
            "X-Organization-Id": org_id,
        },
    ) as c:
        yield c


# ---------------------------------------------------------------------------
# Shared minimal product payload
# ---------------------------------------------------------------------------

_PRODUCT_BASE: dict = {
    "name": "Test Mahsulot",
    "sale_price": "1000",
    "purchase_price": "800",
}


# ---------------------------------------------------------------------------
# TC-1: Valid MXIK — 10 digits (minimum allowed length)
# ---------------------------------------------------------------------------

async def test_create_product_with_valid_mxik_10_digit(org_a_client):
    resp = await org_a_client.post(
        "/api/v1/warehouse/products",
        json={**_PRODUCT_BASE, "mxik": "0902103000"},
    )
    assert resp.status_code == 201, resp.text
    product_id = resp.json()["id"]

    # Verify the value is persisted via GET /products/{id}/full
    full = await org_a_client.get(f"/api/v1/warehouse/products/{product_id}/full")
    assert full.status_code == 200, full.text
    assert full.json()["mxik"] == "0902103000"


# ---------------------------------------------------------------------------
# TC-2: Valid MXIK — 17 digits (maximum allowed length)
# ---------------------------------------------------------------------------

async def test_create_product_with_valid_mxik_17_digit(org_a_client):
    resp = await org_a_client.post(
        "/api/v1/warehouse/products",
        json={**_PRODUCT_BASE, "mxik": "12345678901234567"},
    )
    assert resp.status_code == 201, resp.text
    assert "id" in resp.json()


# ---------------------------------------------------------------------------
# TC-3: Product without mxik field — should store NULL
# ---------------------------------------------------------------------------

async def test_create_product_without_mxik(org_a_client):
    resp = await org_a_client.post(
        "/api/v1/warehouse/products",
        json={**_PRODUCT_BASE},  # no mxik key at all
    )
    assert resp.status_code == 201, resp.text
    product_id = resp.json()["id"]

    full = await org_a_client.get(f"/api/v1/warehouse/products/{product_id}/full")
    assert full.status_code == 200, full.text
    assert full.json()["mxik"] is None


# ---------------------------------------------------------------------------
# TC-4: Explicit null mxik — should store NULL
# ---------------------------------------------------------------------------

async def test_create_product_with_null_mxik(org_a_client):
    resp = await org_a_client.post(
        "/api/v1/warehouse/products",
        json={**_PRODUCT_BASE, "mxik": None},
    )
    assert resp.status_code == 201, resp.text
    product_id = resp.json()["id"]

    full = await org_a_client.get(f"/api/v1/warehouse/products/{product_id}/full")
    assert full.status_code == 200, full.text
    assert full.json()["mxik"] is None


# ---------------------------------------------------------------------------
# TC-5: Invalid MXIK — too short (3 digits, minimum is 10)
# ---------------------------------------------------------------------------

async def test_create_product_invalid_mxik_too_short(org_a_client):
    resp = await org_a_client.post(
        "/api/v1/warehouse/products",
        json={**_PRODUCT_BASE, "mxik": "123"},
    )
    assert resp.status_code == 422, resp.text


# ---------------------------------------------------------------------------
# TC-6: Invalid MXIK — too long (18 digits, maximum is 17)
# ---------------------------------------------------------------------------

async def test_create_product_invalid_mxik_too_long(org_a_client):
    resp = await org_a_client.post(
        "/api/v1/warehouse/products",
        json={**_PRODUCT_BASE, "mxik": "123456789012345678"},
    )
    assert resp.status_code == 422, resp.text


# ---------------------------------------------------------------------------
# TC-7: Invalid MXIK — contains letters (must be digits only)
# ---------------------------------------------------------------------------

async def test_create_product_invalid_mxik_letters(org_a_client):
    resp = await org_a_client.post(
        "/api/v1/warehouse/products",
        json={**_PRODUCT_BASE, "mxik": "ABC1234567"},
    )
    assert resp.status_code == 422, resp.text


# ---------------------------------------------------------------------------
# TC-8: Update MXIK via PUT — new value must be persisted
# ---------------------------------------------------------------------------

async def test_update_mxik(org_a_client):
    # Create product without mxik first
    create = await org_a_client.post(
        "/api/v1/warehouse/products",
        json={**_PRODUCT_BASE},
    )
    assert create.status_code == 201, create.text
    product_id = create.json()["id"]

    # Update via PUT with a valid mxik
    update = await org_a_client.put(
        f"/api/v1/warehouse/products/{product_id}",
        json={**_PRODUCT_BASE, "mxik": "1234567890"},
    )
    assert update.status_code == 200, update.text
    assert update.json().get("ok") is True

    # Read back and confirm the new mxik value is stored
    full = await org_a_client.get(f"/api/v1/warehouse/products/{product_id}/full")
    assert full.status_code == 200, full.text
    assert full.json()["mxik"] == "1234567890"


# ---------------------------------------------------------------------------
# TC-9 (cross-tenant): Org A token cannot access Org B product
# ---------------------------------------------------------------------------

async def test_cross_tenant_isolation_mxik(org_a_client, org_b_client):
    """Org B creates a product with mxik. Org A must receive 404 when
    requesting that product by ID, and the mxik value must not leak."""
    # Org B creates product with a known mxik
    create = await org_b_client.post(
        "/api/v1/warehouse/products",
        json={**_PRODUCT_BASE, "mxik": "0902103000"},
    )
    assert create.status_code == 201, create.text
    org_b_product_id = create.json()["id"]

    # Org A requests Org B's product — must get 404
    full = await org_a_client.get(f"/api/v1/warehouse/products/{org_b_product_id}/full")
    assert full.status_code == 404, (
        f"Cross-tenant isolation failed: Org A got status {full.status_code} "
        f"for Org B product. Response: {full.text[:200]}"
    )

    # The mxik value from Org B must not appear in the 404 response body
    assert "0902103000" not in full.text
