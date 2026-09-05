"""Tests for T-111 Uzum Bank scaffold.

Run against a live API container:
  docker exec erp-api pytest apps/api/tests/test_uzum_scaffold.py -v
"""
import pytest
import httpx

from tests.conftest import API_URL


# ---------------------------------------------------------------------------
# Happy path: uzum appears in /integrations/status
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_uzum_in_status(client: httpx.AsyncClient):
    resp = await client.get("/api/v1/integrations/status")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "uzum" in data, "uzum missing from /integrations/status"
    assert data["uzum"] in {"not_configured", "configured", "active", "error"}


# ---------------------------------------------------------------------------
# Happy path: GET /integrations/uzum returns expected shape
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_uzum_get_config(client: httpx.AsyncClient):
    resp = await client.get("/api/v1/integrations/uzum")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["code"] == "uzum"
    assert data["name"] == "Uzum Bank"
    assert data["category"] == "payment"
    assert data["credentials_required"] is True
    assert "config" in data


# ---------------------------------------------------------------------------
# Happy path: PUT config — client_secret must be encrypted (not returned plain)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_uzum_put_encrypts_client_secret(client: httpx.AsyncClient):
    payload = {
        "client_id": "uzum-test-client-id",
        "client_secret": "super-secret-uzum-key",
        "sandbox": True,
        "callback_url": "https://example.com/uzum/callback",
    }
    resp = await client.put("/api/v1/integrations/uzum", json=payload)
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"ok": True}

    resp2 = await client.get("/api/v1/integrations/uzum")
    assert resp2.status_code == 200
    cfg = resp2.json()["config"]
    # client_id and client_secret are secret fields — must be sensored
    assert cfg.get("client_id") != "uzum-test-client-id", "client_id returned plain-text"
    assert cfg.get("client_secret") != "super-secret-uzum-key", "client_secret returned plain-text"
    assert cfg.get("client_id", "").startswith("***")
    assert cfg.get("client_secret", "").startswith("***")
    # Non-secret fields returned as-is
    assert cfg.get("sandbox") is True
    assert cfg.get("callback_url") == "https://example.com/uzum/callback"


# ---------------------------------------------------------------------------
# Happy path: POST /integrations/uzum/test returns stubbed=True
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_uzum_test_connection_stubbed(client: httpx.AsyncClient):
    # Ensure configured first
    await client.put(
        "/api/v1/integrations/uzum",
        json={"client_id": "cid-xxx", "client_secret": "csecret-xxx"},
    )
    resp = await client.post("/api/v1/integrations/uzum/test")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "ok" in data
    assert data.get("stubbed") is True


# ---------------------------------------------------------------------------
# Error case: POST /test without credentials → 400
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_uzum_test_unconfigured_400(client: httpx.AsyncClient):
    await client.put("/api/v1/integrations/uzum", json={})
    resp = await client.post("/api/v1/integrations/uzum/test")
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Happy path: Uzum webhook stub returns 200 + stubbed=True
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_uzum_webhook_stub(http_client: httpx.AsyncClient):
    resp = await http_client.post(
        "/api/v1/integration/uzum/webhook/TESTORG",
        json={"event": "payment.confirmed", "amount": 50000},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data.get("ok") is True
    assert data.get("stubbed") is True
