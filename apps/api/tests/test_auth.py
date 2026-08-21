"""Authentication tests — login, register, refresh."""
import pytest


async def test_login_success(http_client):
    resp = await http_client.post(
        "/api/v1/auth/login",
        json={"email": "qa@example.com", "password": "Qa12345!"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert len(data["access_token"]) > 20


async def test_login_wrong_password(http_client):
    resp = await http_client.post(
        "/api/v1/auth/login",
        json={"email": "qa@example.com", "password": "WrongPassword99!"},
    )
    # Wrong password returns 401 (invalid credentials) on most setups,
    # or 422 if password fails schema validation (e.g. min length on weak input).
    assert resp.status_code in (401, 422)


async def test_login_missing_fields(http_client):
    resp = await http_client.post("/api/v1/auth/login", json={"email": "qa@example.com"})
    assert resp.status_code == 422


async def test_protected_endpoint_without_token(http_client, org_id):
    """Endpoints under /api/v1/ must reject requests without a token."""
    resp = await http_client.get(
        "/api/v1/sale/sales",
        headers={"X-Organization-Id": org_id},
    )
    assert resp.status_code == 401, "Token-less protected endpoint must be 401"


async def test_protected_endpoint_without_org(http_client, auth_token):
    """Endpoints must require X-Organization-Id header."""
    resp = await http_client.get(
        "/api/v1/sale/sales",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 400, "Missing org header must be 400"


async def test_health_endpoint_public(http_client):
    """Health endpoint should be public (no auth)."""
    resp = await http_client.get("/health")
    assert resp.status_code == 200
    assert resp.json().get("status") == "ok"
