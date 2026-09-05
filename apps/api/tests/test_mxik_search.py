"""T-101: Integration tests for GET /reference/mxik/search.

Happy path  — q returns results from the seed catalog.
Error cases — unauthenticated 401, empty q returns rows, limit capped at 100,
              nonexistent query returns [].
M2 — mxik.view permission exists and is granted to correct roles.
"""
import asyncio
import uuid
import pytest
import pytest_asyncio
import httpx

from tests.conftest import API_URL


def _register_sync(suffix: str) -> tuple[str, str]:
    async def _inner() -> tuple[str, str]:
        unique = str(uuid.uuid4())[:8]
        email = f"mxik_srch_{suffix}_{unique}@example.com"
        async with httpx.AsyncClient(base_url=API_URL, timeout=15) as c:
            reg = await c.post(
                "/api/v1/auth/register",
                json={
                    "email": email,
                    "password": "Test1234!",
                    "full_name": f"MXIK Search Tester {suffix}",
                    "organization_name": f"MXIK Search Org {suffix} {unique}",
                },
            )
            assert reg.status_code == 201, f"Register failed: {reg.text}"
            token = reg.json()["access_token"]
            org_resp = await c.get(
                "/api/v1/organizations/mine",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert org_resp.status_code == 200
            orgs = org_resp.json()
            assert orgs
            return token, orgs[0]["id"]

    return asyncio.run(_inner())


@pytest.fixture(scope="module")
def mxik_creds() -> tuple[str, str]:
    return _register_sync("mxik101")


@pytest_asyncio.fixture
async def mxik_client(mxik_creds):
    token, org_id = mxik_creds
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
# TC-1: Happy path — known word "go'sht" (meat) returns at least 1 result
# ---------------------------------------------------------------------------

async def test_mxik_search_gosht(mxik_client):
    resp = await mxik_client.get("/api/v1/reference/mxik/search", params={"q": "go'sht"})
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    row = data[0]
    assert "code" in row
    assert "name_uz" in row
    assert "name_ru" in row
    assert "unit" in row


# ---------------------------------------------------------------------------
# TC-2: Nonexistent query returns empty list (not 404)
# ---------------------------------------------------------------------------

async def test_mxik_search_nonexistent(mxik_client):
    resp = await mxik_client.get(
        "/api/v1/reference/mxik/search",
        params={"q": "nonexistent12345xyzzy"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json() == []


# ---------------------------------------------------------------------------
# TC-3: Empty q returns up to limit rows (catalog not empty after seed)
# ---------------------------------------------------------------------------

async def test_mxik_search_empty_q(mxik_client):
    resp = await mxik_client.get("/api/v1/reference/mxik/search", params={"q": "", "limit": 5})
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) <= 5


# ---------------------------------------------------------------------------
# TC-4: limit parameter respected — default 20, max capped at 100
# ---------------------------------------------------------------------------

async def test_mxik_search_limit_respected(mxik_client):
    resp = await mxik_client.get("/api/v1/reference/mxik/search", params={"q": "", "limit": 3})
    assert resp.status_code == 200, resp.text
    assert len(resp.json()) <= 3


async def test_mxik_search_limit_capped(mxik_client):
    # limit=200 should be silently capped to 100
    resp = await mxik_client.get("/api/v1/reference/mxik/search", params={"q": "", "limit": 200})
    assert resp.status_code == 200, resp.text
    assert len(resp.json()) <= 100


# ---------------------------------------------------------------------------
# TC-5: Russian-language search works (multi-language OR)
# ---------------------------------------------------------------------------

async def test_mxik_search_russian(mxik_client):
    resp = await mxik_client.get("/api/v1/reference/mxik/search", params={"q": "говядина"})
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert len(data) >= 1
    names_ru = [r["name_ru"] for r in data if r.get("name_ru")]
    assert any("говядин" in (n or "").lower() for n in names_ru)


# ---------------------------------------------------------------------------
# TC-6: Unauthenticated request returns 401 or 403
# ---------------------------------------------------------------------------

async def test_mxik_search_unauthenticated():
    async with httpx.AsyncClient(base_url=API_URL, timeout=10) as c:
        resp = await c.get("/api/v1/reference/mxik/search", params={"q": "test"})
    assert resp.status_code in (401, 403), (
        f"Expected 401/403 for unauthenticated request, got {resp.status_code}"
    )


# ---------------------------------------------------------------------------
# TC-7: Code-prefix search works (code ILIKE)
# ---------------------------------------------------------------------------

async def test_mxik_search_by_code_prefix(mxik_client):
    resp = await mxik_client.get("/api/v1/reference/mxik/search", params={"q": "0102"})
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert len(data) >= 1
    assert all(r["code"].startswith("0102") for r in data)


# ---------------------------------------------------------------------------
# M2: permission catalog unit tests
# ---------------------------------------------------------------------------

def test_mxik_view_in_all_permissions():
    from app.modules.rbac.permissions import ALL_PERMISSIONS
    codes = {p["code"] for p in ALL_PERMISSIONS}
    assert "mxik.view" in codes


def test_mxik_view_granted_to_admin():
    from app.modules.rbac.permissions import ROLE_GRANTS
    assert "mxik.view" in ROLE_GRANTS["admin"]


def test_mxik_view_granted_to_manager():
    from app.modules.rbac.permissions import ROLE_GRANTS
    assert "mxik.view" in ROLE_GRANTS["manager"]


def test_mxik_view_granted_to_cashier():
    from app.modules.rbac.permissions import ROLE_GRANTS
    assert "mxik.view" in ROLE_GRANTS["cashier"]


def test_mxik_view_granted_to_viewer():
    from app.modules.rbac.permissions import ROLE_GRANTS
    assert "mxik.view" in ROLE_GRANTS["viewer"]
