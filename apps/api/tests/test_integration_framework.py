"""Tests for T-100 Integration Framework (DESIGN-3 §5).

Run against a live API container:
  docker exec erp-api pytest apps/api/tests/test_integration_framework.py -v
"""
import pytest
import pytest_asyncio
import httpx

from tests.conftest import API_URL


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _headers(token: str, org: str) -> dict:
    return {"Authorization": f"Bearer {token}", "X-Organization-Id": org}


# ---------------------------------------------------------------------------
# Happy path: GET /integrations — returns array with required fields
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_integrations_returns_all(client: httpx.AsyncClient):
    resp = await client.get("/api/v1/integrations")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 15  # registry has exactly 15 entries

    codes = {item["code"] for item in data}
    for expected in ("alif", "uzum", "multicard", "rahmat", "click", "payme",
                     "bill_payment", "didox", "yandex_delivery", "bts_delivery",
                     "telegram", "eskiz", "barcode", "1c_export", "mxik"):
        assert expected in codes, f"{expected} missing from registry"

    # Schema check on first item
    item = data[0]
    for field in ("code", "name", "category", "enabled",
                  "credentials_required", "configured", "status"):
        assert field in item, f"Field '{field}' missing"

    valid_statuses = {"not_configured", "configured", "active", "error"}
    for item in data:
        assert item["status"] in valid_statuses


# ---------------------------------------------------------------------------
# Happy path: GET /integrations/{code} — sensored config returned
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_single_integration(client: httpx.AsyncClient):
    resp = await client.get("/api/v1/integrations/alif")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["code"] == "alif"
    assert data["name"] == "Alif Bank"
    assert data["category"] == "payment"
    assert "configured" in data
    assert "config" in data


# ---------------------------------------------------------------------------
# Error case: unknown code → 404
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_unknown_integration_404(client: httpx.AsyncClient):
    resp = await client.get("/api/v1/integrations/unknown_xyz")
    assert resp.status_code == 404
    assert "topilmadi" in resp.json().get("detail", "").lower()


# ---------------------------------------------------------------------------
# Happy path: PUT /integrations/{code} — save config; secrets must be encrypted
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_put_config_encrypts_secrets(client: httpx.AsyncClient):
    payload = {
        "merchant_id": "test-merchant-123",
        "api_key": "super-secret-key-abc",
        "sandbox_url": "https://alifpay.uz/sandbox",
    }
    resp = await client.put("/api/v1/integrations/alif", json=payload)
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"ok": True}

    # Read back — secrets must be sensored, not raw
    resp2 = await client.get("/api/v1/integrations/alif")
    assert resp2.status_code == 200
    cfg = resp2.json()["config"]
    # merchant_id and api_key are secret fields — must be sensored
    assert cfg.get("merchant_id") != "test-merchant-123", "Secret was returned plain-text!"
    assert cfg.get("api_key") != "super-secret-key-abc", "Secret was returned plain-text!"
    # Sensor pattern: "***" + last 4 chars
    assert cfg.get("merchant_id", "").startswith("***")
    assert cfg.get("api_key", "").startswith("***")
    # Non-secret field returned as-is
    assert cfg.get("sandbox_url") == "https://alifpay.uz/sandbox"


# ---------------------------------------------------------------------------
# Error case: PUT unknown code → 404
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_put_unknown_code_404(client: httpx.AsyncClient):
    resp = await client.put("/api/v1/integrations/no_such_provider", json={})
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Happy path: POST /integrations/{code}/test — scaffold returns ok=False + stubbed
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_connection_scaffold_returns_stubbed(client: httpx.AsyncClient):
    # First save required fields so it passes the is_configured check
    await client.put(
        "/api/v1/integrations/uzum",
        json={"client_id": "cid", "client_secret": "csecret"},
    )
    resp = await client.post("/api/v1/integrations/uzum/test")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "ok" in data
    assert "message" in data
    # Scaffold always returns stubbed=True
    assert data.get("stubbed") is True


# ---------------------------------------------------------------------------
# Error case: POST /test without config → 400
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_connection_unconfigured_returns_400(client: httpx.AsyncClient):
    # Use a fresh code not yet configured in this test run
    # We reset by saving empty payload first
    await client.put("/api/v1/integrations/rahmat", json={})
    resp = await client.post("/api/v1/integrations/rahmat/test")
    # rahmat requires credentials and has none after empty PUT
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Happy path: POST /integrations/{code}/enable and /disable
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_enable_disable_no_credentials_integration(client: httpx.AsyncClient):
    # barcode requires no credentials — enable/disable freely
    resp = await client.post("/api/v1/integrations/barcode/enable")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "enabled": True}

    resp = await client.post("/api/v1/integrations/barcode/disable")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "enabled": False}


# ---------------------------------------------------------------------------
# Error case: enable with missing config → 400
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_enable_unconfigured_returns_400(client: httpx.AsyncClient):
    # Reset didox to empty
    await client.put("/api/v1/integrations/didox", json={})
    resp = await client.post("/api/v1/integrations/didox/enable")
    assert resp.status_code == 400
    assert "sozlang" in resp.json().get("detail", "").lower()


# ---------------------------------------------------------------------------
# Happy path: GET /integrations/status — status map
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_status_endpoint_returns_map(client: httpx.AsyncClient):
    resp = await client.get("/api/v1/integrations/status")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert isinstance(data, dict)
    valid = {"not_configured", "configured", "active", "error"}
    for code, status in data.items():
        assert status in valid, f"{code}: unexpected status '{status}'"
    assert "alif" in data
    assert "barcode" in data


# ---------------------------------------------------------------------------
# RBAC guard: unauthenticated request → 401 or 400 (no token/org)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_integrations_unauthenticated(http_client: httpx.AsyncClient):
    resp = await http_client.get("/api/v1/integrations")
    # X-Organization-Id is missing → 400; or no JWT → 401/403
    assert resp.status_code in (400, 401, 403)
