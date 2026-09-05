"""Tests for T-112 Multicard scaffold.

Run against a live API container:
  docker exec erp-api pytest apps/api/tests/test_multicard_scaffold.py -v
"""
import pytest
import httpx

from tests.conftest import API_URL, TEST_ORG_CODE


# ---------------------------------------------------------------------------
# Happy path: multicard appears in /integrations/status
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_multicard_in_status(client: httpx.AsyncClient):
    resp = await client.get("/api/v1/integrations/status")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "multicard" in data
    assert data["multicard"] in {"not_configured", "configured", "active", "error"}


# ---------------------------------------------------------------------------
# Happy path: GET /integrations/multicard returns correct metadata
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_multicard_get_config(client: httpx.AsyncClient):
    resp = await client.get("/api/v1/integrations/multicard")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["code"] == "multicard"
    assert data["name"] == "Multicard"
    assert data["category"] == "payment"
    assert data["credentials_required"] is True
    assert "config" in data


# ---------------------------------------------------------------------------
# Happy path: PUT config + secret masking for api_key
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_multicard_put_config_masks_api_key(client: httpx.AsyncClient):
    payload = {
        "api_key": "test-secret-api-key-xyz",
        "terminal_id": "TID-001",
        "store_id": "STORE-9",
        "sandbox": True,
    }
    resp = await client.put("/api/v1/integrations/multicard", json=payload)
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"ok": True}

    resp2 = await client.get("/api/v1/integrations/multicard")
    assert resp2.status_code == 200
    cfg = resp2.json()["config"]
    assert cfg.get("api_key") != "test-secret-api-key-xyz", "api_key returned plain-text"
    assert cfg.get("api_key", "").startswith("***"), "api_key not masked"
    assert cfg.get("terminal_id") == "TID-001"
    assert cfg.get("store_id") == "STORE-9"
    assert cfg.get("sandbox") is True


# ---------------------------------------------------------------------------
# Happy path: test_connection returns stubbed=True
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_multicard_test_connection_stubbed(client: httpx.AsyncClient):
    await client.put(
        "/api/v1/integrations/multicard",
        json={"api_key": "any-key", "terminal_id": "TID-X"},
    )
    resp = await client.post("/api/v1/integrations/multicard/test")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data.get("stubbed") is True
    assert "message" in data


# ---------------------------------------------------------------------------
# Error case: test without credentials → 400
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_multicard_test_unconfigured_400(client: httpx.AsyncClient):
    await client.put("/api/v1/integrations/multicard", json={})
    resp = await client.post("/api/v1/integrations/multicard/test")
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Happy path: webhook stub returns ok=True (unknown org → ok=False, not crash)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_multicard_webhook_unknown_org(http_client: httpx.AsyncClient):
    resp = await http_client.post(
        "/api/v1/integration/multicard/webhook/UNKNOWN_ORG_XYZ",
        json={"event": "payment", "amount": 10000},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data.get("ok") is False
    assert "error" in data


# ---------------------------------------------------------------------------
# Happy path: webhook stub with valid org returns ok=True, stubbed=True
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_multicard_webhook_valid_org(http_client: httpx.AsyncClient):
    resp = await http_client.post(
        f"/api/v1/integration/multicard/webhook/{TEST_ORG_CODE}",
        json={"event": "payment.complete", "amount": 50000},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data.get("ok") is True
    assert data.get("stubbed") is True
