"""Tests for T-120 Didox e-invoice scaffold.

Run against live API container:
  docker exec erp-api pytest apps/api/tests/test_didox_scaffold.py -v
"""
import pytest
import pytest_asyncio
import httpx

from tests.conftest import API_URL


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

DIDOX_CODE = "didox"


# ---------------------------------------------------------------------------
# 1. Config save + load (registry GET returns sensored secrets)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_didox_config_save_and_load(client: httpx.AsyncClient):
    payload = {
        "stir": "123456789",
        "developer_token": "super-secret-dev-token-xyz",
        "signer_pin": "1234",
        "sandbox": True,
    }
    resp = await client.put(f"/api/v1/integrations/{DIDOX_CODE}", json=payload)
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"ok": True}

    resp2 = await client.get(f"/api/v1/integrations/{DIDOX_CODE}")
    assert resp2.status_code == 200
    data = resp2.json()
    cfg = data["config"]

    # Non-secret field returned as-is
    assert cfg.get("stir") == "123456789"
    assert cfg.get("sandbox") is True

    # Secret fields must be masked
    assert cfg.get("developer_token") != "super-secret-dev-token-xyz", "Secret returned plain!"
    assert cfg.get("developer_token", "").startswith("***")
    assert cfg.get("signer_pin") != "1234", "Secret returned plain!"
    assert cfg.get("signer_pin", "").startswith("***")


# ---------------------------------------------------------------------------
# 2. test_connection stub — with config returns ok=True + stubbed=True
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_didox_test_connection_stub(client: httpx.AsyncClient):
    # Ensure required fields are present
    await client.put(
        f"/api/v1/integrations/{DIDOX_CODE}",
        json={"stir": "987654321", "developer_token": "some-valid-token"},
    )
    resp = await client.post(f"/api/v1/integrations/{DIDOX_CODE}/test")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data.get("ok") is True
    assert data.get("stubbed") is True
    assert "stub" in data.get("message", "").lower()


# ---------------------------------------------------------------------------
# 3. test_connection — missing credentials returns ok=False
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_didox_test_connection_no_credentials(client: httpx.AsyncClient):
    # Clear config
    await client.put(f"/api/v1/integrations/{DIDOX_CODE}", json={})
    # is_configured() will be False — hub returns 400 before calling test_connection
    resp = await client.post(f"/api/v1/integrations/{DIDOX_CODE}/test")
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# 4. POST /integration/didox/invoice/create — disabled → 400
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_didox_create_invoice_disabled_returns_400(client: httpx.AsyncClient):
    # Ensure Didox is disabled (disable it via hub)
    await client.post(f"/api/v1/integrations/{DIDOX_CODE}/disable")

    resp = await client.post(
        "/api/v1/integration/didox/invoice/create",
        json={"sale_id": "some-sale-uuid"},
    )
    assert resp.status_code == 400
    assert "yoqilmagan" in resp.json().get("detail", "")


# ---------------------------------------------------------------------------
# 5. POST /integration/didox/invoice/create — enabled → stub 200
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_didox_create_invoice_enabled_returns_stub(client: httpx.AsyncClient):
    # Configure and enable Didox
    await client.put(
        f"/api/v1/integrations/{DIDOX_CODE}",
        json={"stir": "111222333", "developer_token": "enabled-token"},
    )
    await client.post(f"/api/v1/integrations/{DIDOX_CODE}/enable")

    resp = await client.post(
        "/api/v1/integration/didox/invoice/create",
        json={"sale_id": "test-sale-001"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data.get("invoice_id") == "stub-123"
    assert data.get("status") == "draft"
    assert data.get("stubbed") is True
    assert data.get("sale_id") == "test-sale-001"


# ---------------------------------------------------------------------------
# 6. POST /integration/didox/invoice/create — missing sale_id → 422
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_didox_create_invoice_missing_sale_id_422(client: httpx.AsyncClient):
    # Didox must be enabled from previous test or re-enable here
    await client.put(
        f"/api/v1/integrations/{DIDOX_CODE}",
        json={"stir": "111222333", "developer_token": "enabled-token"},
    )
    await client.post(f"/api/v1/integrations/{DIDOX_CODE}/enable")

    resp = await client.post(
        "/api/v1/integration/didox/invoice/create",
        json={},
    )
    assert resp.status_code == 422
    assert "sale_id" in resp.json().get("detail", "")


# ---------------------------------------------------------------------------
# 7. GET /integration/didox/invoice/{id} — enabled → stub 200
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_didox_get_invoice_status_stub(client: httpx.AsyncClient):
    await client.post(f"/api/v1/integrations/{DIDOX_CODE}/enable")

    resp = await client.get("/api/v1/integration/didox/invoice/stub-123")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data.get("invoice_id") == "stub-123"
    assert data.get("stubbed") is True


# ---------------------------------------------------------------------------
# 8. POST /integration/didox/invoice/{id}/send — enabled → stub 200
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_didox_send_invoice_stub(client: httpx.AsyncClient):
    await client.post(f"/api/v1/integrations/{DIDOX_CODE}/enable")

    resp = await client.post("/api/v1/integration/didox/invoice/stub-123/send")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data.get("invoice_id") == "stub-123"
    assert data.get("status") == "sent"
    assert data.get("stubbed") is True


# ---------------------------------------------------------------------------
# 9. POST /integration/didox/webhook — no auth required, always 200
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_didox_webhook_scaffold(http_client: httpx.AsyncClient):
    resp = await http_client.post(
        "/api/v1/integration/didox/webhook",
        json={"event": "invoice_accepted", "invoice_id": "stub-123"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data.get("ok") is True
    assert data.get("stubbed") is True
