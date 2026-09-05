"""Tests for T-110 — Alif Bank scaffold (DESIGN-3 §5, T-110 acceptance criteria).

Run against a live API container:
  docker exec erp-api pytest apps/api/tests/test_alif_scaffold.py -v
"""
import pytest
import httpx

from tests.conftest import API_URL


# ---------------------------------------------------------------------------
# Happy path: GET /integrations/alif — "alif" entry present in registry
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_alif_present_in_integrations_list(client: httpx.AsyncClient):
    resp = await client.get("/api/v1/integrations")
    assert resp.status_code == 200, resp.text
    codes = {item["code"] for item in resp.json()}
    assert "alif" in codes


# ---------------------------------------------------------------------------
# Happy path: GET /integrations/alif — correct schema
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_alif_integration_schema(client: httpx.AsyncClient):
    resp = await client.get("/api/v1/integrations/alif")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["code"] == "alif"
    assert data["name"] == "Alif Bank"
    assert data["category"] == "payment"
    assert data["credentials_required"] is True
    assert "configured" in data
    assert "config" in data


# ---------------------------------------------------------------------------
# Happy path: PUT /integrations/alif — save config; secrets must be encrypted
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_alif_config_save_and_secrets_sensored(client: httpx.AsyncClient):
    payload = {
        "merchant_id": "alif-merchant-999",
        "api_key": "secret-alif-key-xyz",
        "sandbox": True,
        "webhook_url": "https://example.com/alif/callback",
    }
    resp = await client.put("/api/v1/integrations/alif", json=payload)
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"ok": True}

    resp2 = await client.get("/api/v1/integrations/alif")
    assert resp2.status_code == 200
    cfg = resp2.json()["config"]
    # Secret fields must be sensored
    assert cfg.get("api_key") != "secret-alif-key-xyz", "api_key returned plain-text!"
    assert cfg.get("api_key", "").startswith("***")
    # Non-secret fields returned as-is
    assert cfg.get("webhook_url") == "https://example.com/alif/callback"


# ---------------------------------------------------------------------------
# Happy path: POST /integrations/alif/test — credentials present → ok=True + provider
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_alif_test_connection_with_credentials(client: httpx.AsyncClient):
    # Save credentials first
    await client.put(
        "/api/v1/integrations/alif",
        json={"merchant_id": "mid-001", "api_key": "key-001"},
    )
    resp = await client.post("/api/v1/integrations/alif/test")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["ok"] is True
    assert data.get("provider") == "alif"


# ---------------------------------------------------------------------------
# Error case: POST /integrations/alif/test — no credentials → 400
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_alif_test_connection_missing_credentials_returns_400(client: httpx.AsyncClient):
    # Clear config by saving empty payload
    await client.put("/api/v1/integrations/alif", json={})
    resp = await client.post("/api/v1/integrations/alif/test")
    assert resp.status_code == 400
    assert "toʻliq" in resp.json().get("detail", "").lower() or "to" in resp.json().get("detail", "").lower()


# ---------------------------------------------------------------------------
# Happy path: POST /integration/alif/webhook/<org_code> — returns 200
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_alif_webhook_returns_200(http_client: httpx.AsyncClient):
    payload = {"event": "payment.completed", "order_id": "ord-123", "amount": 50000}
    resp = await http_client.post(
        "/api/v1/integration/alif/webhook/ANIQ",
        json=payload,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data.get("status") == "received"
    assert "note" in data


# ---------------------------------------------------------------------------
# Error case: GET /integrations/unknown_integration → 404
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_unknown_integration_404(client: httpx.AsyncClient):
    resp = await client.get("/api/v1/integrations/no_such_alif_provider")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Audit redaction: merchant_id must be in SENSITIVE_KEYS
# ---------------------------------------------------------------------------

def test_audit_sensitive_keys_include_merchant_id():
    from app.modules.audit.middleware import SENSITIVE_KEYS
    assert "merchant_id" in SENSITIVE_KEYS
    assert "api_key" in SENSITIVE_KEYS
