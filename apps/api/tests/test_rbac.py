"""RBAC enforcement tests."""
import pytest


async def test_me_permissions_returns_role(client):
    resp = await client.get("/api/v1/rbac/me/permissions")
    assert resp.status_code == 200
    data = resp.json()
    assert "role" in data
    assert "permissions" in data
    assert isinstance(data["permissions"], list)
    # qa@example.com is admin by default after seed
    assert data["role"]["code"] in ("admin", "superadmin")


async def test_roles_list(client):
    resp = await client.get("/api/v1/rbac/roles")
    assert resp.status_code == 200
    roles = resp.json()
    role_codes = {r["code"] for r in roles}
    # Standard roles seeded
    assert {"superadmin", "admin", "manager", "accountant", "cashier", "viewer"}.issubset(role_codes)


async def test_permissions_catalog(client):
    resp = await client.get("/api/v1/rbac/permissions")
    assert resp.status_code == 200
    perms = resp.json()
    codes = {p["code"] for p in perms}
    assert "sale.view" in codes
    assert "rbac.manage" in codes
    assert "audit.view" in codes


async def test_users_list(client):
    resp = await client.get("/api/v1/rbac/users")
    assert resp.status_code == 200
    users = resp.json()
    emails = {u["email"] for u in users}
    assert "qa@example.com" in emails


@pytest.mark.parametrize("endpoint", [
    "/api/v1/sale/sales",
    "/api/v1/warehouse/products",
    "/api/v1/customer/customers",
    "/api/v1/finance/cashboxes",
])
async def test_admin_can_access(client, endpoint):
    """Admin user should access core endpoints."""
    resp = await client.get(endpoint)
    assert resp.status_code == 200, f"{endpoint} failed: {resp.status_code} {resp.text[:200]}"


async def test_cannot_modify_superadmin_role(client):
    """Admin doesn't have rbac.manage by default, so middleware blocks at 403.
    If admin had rbac.manage, the route handler would reject superadmin edit with 400."""
    roles_resp = await client.get("/api/v1/rbac/roles")
    sa_role = next((r for r in roles_resp.json() if r["code"] == "superadmin"), None)
    if not sa_role:
        pytest.skip("superadmin role not present")

    resp = await client.put(
        f"/api/v1/rbac/roles/{sa_role['id']}/permissions",
        json={"permission_ids": []},
    )
    # Either 403 (no rbac.manage perm) or 400 (route's superadmin protection)
    assert resp.status_code in (400, 403), "Modifying superadmin must be blocked"
