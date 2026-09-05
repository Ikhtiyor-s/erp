"""Tests for T-113 Rahmat loyalty scaffold.

Run against a live API container:
  docker exec erp-api pytest apps/api/tests/test_rahmat_scaffold.py -v
"""
import pytest
import httpx

from tests.conftest import API_URL


def _headers(token: str, org: str) -> dict:
    return {"Authorization": f"Bearer {token}", "X-Organization-Id": org}


# ---------------------------------------------------------------------------
# Unit-level: RahmatService class contract
# ---------------------------------------------------------------------------

def test_rahmat_service_attributes():
    from app.modules.integration.payments.rahmat import RahmatService
    assert RahmatService.code == "rahmat"
    assert RahmatService.category == "payment"
    assert RahmatService.credentials_required is True
    assert "merchant_token" in RahmatService._secret_fields(None)  # type: ignore[arg-type]
    assert "secret" in RahmatService._secret_fields(None)  # type: ignore[arg-type]
    assert "merchant_token" in RahmatService._required_fields(None)  # type: ignore[arg-type]


def test_rahmat_register_transaction_raises():
    import asyncio
    from unittest.mock import MagicMock
    from app.modules.integration.payments.rahmat import RahmatService

    svc = RahmatService(db=MagicMock(), org_id="test-org")
    with pytest.raises(NotImplementedError):
        asyncio.get_event_loop().run_until_complete(
            svc.register_transaction("sale-id", 1000.0)
        )


def test_rahmat_in_registry():
    from app.modules.integration.registry import INTEGRATION_REGISTRY
    from app.modules.integration.payments.rahmat import RahmatService
    assert "rahmat" in INTEGRATION_REGISTRY
    assert INTEGRATION_REGISTRY["rahmat"] is RahmatService


# ---------------------------------------------------------------------------
# Integration: GET /integrations/status includes "rahmat" (requires running API)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_rahmat_appears_in_status(client: httpx.AsyncClient):
    resp = await client.get("/api/v1/integrations/status")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "rahmat" in data, "rahmat must appear in /integrations/status"
    assert data["rahmat"] in ("not_configured", "configured", "active")


# ---------------------------------------------------------------------------
# Integration: POST /integration/rahmat/webhook/{org_code} — stub returns 200
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_rahmat_webhook_stub_returns_ok(client: httpx.AsyncClient):
    resp = await client.post(
        "/api/v1/integration/rahmat/webhook/NONEXISTENT",
        json={"event": "test"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data.get("ok") is False
    assert "not found" in data.get("error", "").lower()


@pytest.mark.asyncio
async def test_rahmat_webhook_returns_stubbed(client: httpx.AsyncClient, auth_token: str, org_id: str):
    """With a valid org code the webhook returns stubbed=True."""
    org_res = await client.get(
        "/api/v1/organization/me",
        headers=_headers(auth_token, org_id),
    )
    if org_res.status_code != 200:
        pytest.skip("Cannot fetch org code — skip live webhook test")
    org_code = org_res.json().get("code", "")
    if not org_code:
        pytest.skip("Org has no code — skip live webhook test")

    resp = await client.post(
        f"/api/v1/integration/rahmat/webhook/{org_code}",
        json={"event": "cashback_accrued", "amount": 500},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data.get("ok") is True
    assert data.get("stubbed") is True
