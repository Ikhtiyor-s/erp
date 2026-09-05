"""Tests for T-121 (Yandex Delivery) + T-122 (BTS Delivery) scaffolds.

Run against a live API container:
  docker exec erp-api pytest apps/api/tests/test_delivery_scaffold.py -v
"""
import pytest
import httpx

from tests.conftest import API_URL


# ===========================================================================
# Shared helpers
# ===========================================================================

PROVIDERS = [
    ("yandex_delivery", "Yandex Delivery", "yandex", "oauth_token", "sender_id"),
    ("bts_delivery",    "BTS Delivery",     "bts",    "api_key",     "account_id"),
]


# ===========================================================================
# T-121 / T-122 acceptance: both providers visible in /integrations/status
# ===========================================================================

@pytest.mark.asyncio
async def test_yandex_delivery_in_status(client: httpx.AsyncClient):
    resp = await client.get("/api/v1/integrations/status")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "yandex_delivery" in data, "yandex_delivery missing from /integrations/status"
    assert data["yandex_delivery"] in {"not_configured", "configured", "active", "error"}


@pytest.mark.asyncio
async def test_bts_delivery_in_status(client: httpx.AsyncClient):
    resp = await client.get("/api/v1/integrations/status")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "bts_delivery" in data, "bts_delivery missing from /integrations/status"
    assert data["bts_delivery"] in {"not_configured", "configured", "active", "error"}


# ===========================================================================
# GET /integrations/{code} — schema check
# ===========================================================================

@pytest.mark.asyncio
async def test_yandex_delivery_get_config(client: httpx.AsyncClient):
    resp = await client.get("/api/v1/integrations/yandex_delivery")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["code"] == "yandex_delivery"
    assert data["name"] == "Yandex Delivery"
    assert data["category"] == "delivery"
    assert data["credentials_required"] is True
    assert "config" in data


@pytest.mark.asyncio
async def test_bts_delivery_get_config(client: httpx.AsyncClient):
    resp = await client.get("/api/v1/integrations/bts_delivery")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["code"] == "bts_delivery"
    assert data["name"] == "BTS Delivery"
    assert data["category"] == "delivery"
    assert data["credentials_required"] is True
    assert "config" in data


# ===========================================================================
# PUT config — secret fields must be encrypted (not returned plain-text)
# ===========================================================================

@pytest.mark.asyncio
async def test_yandex_delivery_config_save_encrypts_oauth_token(client: httpx.AsyncClient):
    payload = {
        "oauth_token": "ya-token-secret-abc123",
        "sender_id": "sender-99",
        "warehouse_id": "wh-01",
        "sandbox": True,
    }
    resp = await client.put("/api/v1/integrations/yandex_delivery", json=payload)
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"ok": True}

    resp2 = await client.get("/api/v1/integrations/yandex_delivery")
    assert resp2.status_code == 200
    cfg = resp2.json()["config"]
    assert cfg.get("oauth_token") != "ya-token-secret-abc123", "oauth_token returned plain-text!"
    assert cfg.get("oauth_token", "").startswith("***")
    assert cfg.get("sender_id") == "sender-99"
    assert cfg.get("sandbox") is True


@pytest.mark.asyncio
async def test_bts_delivery_config_save_encrypts_api_key(client: httpx.AsyncClient):
    payload = {
        "api_key": "bts-secret-key-xyz",
        "account_id": "acc-42",
        "sandbox": True,
    }
    resp = await client.put("/api/v1/integrations/bts_delivery", json=payload)
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"ok": True}

    resp2 = await client.get("/api/v1/integrations/bts_delivery")
    assert resp2.status_code == 200
    cfg = resp2.json()["config"]
    assert cfg.get("api_key") != "bts-secret-key-xyz", "api_key returned plain-text!"
    assert cfg.get("api_key", "").startswith("***")
    assert cfg.get("account_id") == "acc-42"


# ===========================================================================
# POST /test — with credentials → ok=True, stubbed=True
# ===========================================================================

@pytest.mark.asyncio
async def test_yandex_delivery_test_connection_with_credentials(client: httpx.AsyncClient):
    await client.put(
        "/api/v1/integrations/yandex_delivery",
        json={"oauth_token": "tok-111", "sender_id": "sid-111"},
    )
    resp = await client.post("/api/v1/integrations/yandex_delivery/test")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data.get("ok") is True
    assert data.get("stubbed") is True


@pytest.mark.asyncio
async def test_bts_delivery_test_connection_with_credentials(client: httpx.AsyncClient):
    await client.put(
        "/api/v1/integrations/bts_delivery",
        json={"api_key": "key-222", "account_id": "acc-222"},
    )
    resp = await client.post("/api/v1/integrations/bts_delivery/test")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data.get("ok") is True
    assert data.get("stubbed") is True


# ===========================================================================
# POST /test — missing credentials → 400
# ===========================================================================

@pytest.mark.asyncio
async def test_yandex_delivery_test_unconfigured_returns_400(client: httpx.AsyncClient):
    await client.put("/api/v1/integrations/yandex_delivery", json={})
    resp = await client.post("/api/v1/integrations/yandex_delivery/test")
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_bts_delivery_test_unconfigured_returns_400(client: httpx.AsyncClient):
    await client.put("/api/v1/integrations/bts_delivery", json={})
    resp = await client.post("/api/v1/integrations/bts_delivery/test")
    assert resp.status_code == 400


# ===========================================================================
# Delivery stub endpoints — dispatch by short provider alias
# ===========================================================================

@pytest.mark.asyncio
async def test_yandex_estimate_returns_stub(client: httpx.AsyncClient):
    resp = await client.post(
        "/api/v1/integrations/delivery/yandex/estimate",
        json={"address": {"city": "Toshkent"}, "items": [{"weight": 1.0}]},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data.get("status") == "stub"
    assert data.get("stubbed") is True


@pytest.mark.asyncio
async def test_bts_estimate_returns_stub(client: httpx.AsyncClient):
    resp = await client.post(
        "/api/v1/integrations/delivery/bts/estimate",
        json={"address": {"city": "Samarqand"}, "items": []},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data.get("status") == "stub"
    assert data.get("stubbed") is True


@pytest.mark.asyncio
async def test_yandex_create_shipment_returns_stub(client: httpx.AsyncClient):
    resp = await client.post(
        "/api/v1/integrations/delivery/yandex/shipment/create",
        json={"sale_id": "sale-001", "address": {}, "items": []},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json().get("stubbed") is True


@pytest.mark.asyncio
async def test_bts_create_shipment_returns_stub(client: httpx.AsyncClient):
    resp = await client.post(
        "/api/v1/integrations/delivery/bts/shipment/create",
        json={"sale_id": "sale-002", "address": {}, "items": []},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json().get("stubbed") is True


@pytest.mark.asyncio
async def test_yandex_track_shipment_returns_stub(client: httpx.AsyncClient):
    resp = await client.get("/api/v1/integrations/delivery/yandex/shipment/TRACK-001")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data.get("stubbed") is True
    assert data.get("tracking_id") == "TRACK-001"


@pytest.mark.asyncio
async def test_bts_track_shipment_returns_stub(client: httpx.AsyncClient):
    resp = await client.get("/api/v1/integrations/delivery/bts/shipment/BTS-999")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data.get("stubbed") is True
    assert data.get("tracking_id") == "BTS-999"


@pytest.mark.asyncio
async def test_yandex_cancel_shipment_returns_stub(client: httpx.AsyncClient):
    resp = await client.post("/api/v1/integrations/delivery/yandex/shipment/TRACK-001/cancel")
    assert resp.status_code == 200, resp.text
    assert resp.json().get("stubbed") is True


@pytest.mark.asyncio
async def test_bts_cancel_shipment_returns_stub(client: httpx.AsyncClient):
    resp = await client.post("/api/v1/integrations/delivery/bts/shipment/BTS-999/cancel")
    assert resp.status_code == 200, resp.text
    assert resp.json().get("stubbed") is True


@pytest.mark.asyncio
async def test_yandex_webhook_returns_ok(http_client: httpx.AsyncClient):
    resp = await http_client.post(
        "/api/v1/integrations/delivery/yandex/webhook",
        json={"event": "shipment.delivered", "order_id": "ord-xyz"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data.get("ok") is True
    assert data.get("stubbed") is True
    assert data.get("provider") == "yandex"


@pytest.mark.asyncio
async def test_bts_webhook_returns_ok(http_client: httpx.AsyncClient):
    resp = await http_client.post(
        "/api/v1/integrations/delivery/bts/webhook",
        json={"status": "delivered", "shipment_id": "s-001"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data.get("ok") is True
    assert data.get("stubbed") is True
    assert data.get("provider") == "bts"


# ===========================================================================
# Error case: unknown delivery provider → 404
# ===========================================================================

@pytest.mark.asyncio
async def test_unknown_delivery_provider_404(client: httpx.AsyncClient):
    resp = await client.post(
        "/api/v1/integrations/delivery/laposte/shipment/create",
        json={},
    )
    assert resp.status_code == 404


# ===========================================================================
# Unit test: SENSITIVE_KEYS covers delivery secret fields
# ===========================================================================

def test_sensitive_keys_cover_delivery_secrets():
    from app.modules.audit.middleware import SENSITIVE_KEYS
    assert "oauth_token" in SENSITIVE_KEYS, "oauth_token must be in SENSITIVE_KEYS"
    assert "api_key" in SENSITIVE_KEYS, "api_key must be in SENSITIVE_KEYS"
