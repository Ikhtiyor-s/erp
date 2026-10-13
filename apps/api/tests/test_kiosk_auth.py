"""SC-2 — kiosk device-credential auth dependency (`get_current_kiosk_device`).

Acceptance tests named per tickets/DESIGN-self-checkout-auth.md's own test
list. Device/cashbox setup goes through the real HTTP API using the shared
session admin (conftest.py's `client` fixture); the kiosk-token calls under
test use a bare httpx client with no staff auth headers at all — exactly how
a real kiosk device calls GET /api/v1/kiosk/session.

Run inside the container:
    docker exec erp-api python -m pytest tests/test_kiosk_auth.py -v
"""
import uuid

import httpx
import pytest


API_URL = "http://localhost:8000"


async def _first_currency_id(client: httpx.AsyncClient) -> int:
    res = await client.get("/api/v1/reference/currencies")
    assert res.status_code == 200, res.text
    return res.json()[0]["id"]


async def _first_warehouse_id(client: httpx.AsyncClient) -> int:
    res = await client.get("/api/v1/warehouse/warehouses")
    assert res.status_code == 200, res.text
    return res.json()[0]["id"]


async def _create_cashbox(client: httpx.AsyncClient) -> int:
    currency_id = await _first_currency_id(client)
    warehouse_id = await _first_warehouse_id(client)
    res = await client.post(
        "/api/v1/finance/cashboxes",
        json={
            "name": f"Kiosk Auth Test Cashbox {uuid.uuid4().hex[:8]}",
            "currency_id": currency_id,
            "warehouse_id": warehouse_id,
        },
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


async def _create_kiosk_device(client: httpx.AsyncClient, cashbox_id: int) -> dict:
    res = await client.post(
        "/api/v1/kiosk-devices",
        json={"name": f"Kiosk Auth Test Device {uuid.uuid4().hex[:8]}", "cashbox_id": cashbox_id},
    )
    assert res.status_code == 201, res.text
    return res.json()


async def _revoke_kiosk_device(client: httpx.AsyncClient, device_id: str) -> None:
    res = await client.delete(f"/api/v1/kiosk-devices/{device_id}")
    assert res.status_code == 200, res.text


async def _rotate_kiosk_device(client: httpx.AsyncClient, device_id: str) -> dict:
    res = await client.post(f"/api/v1/kiosk-devices/{device_id}/rotate")
    assert res.status_code == 200, res.text
    return res.json()


async def _kiosk_session(token: str) -> httpx.Response:
    """Bare client — no Authorization/X-Organization-Id baked in, so this
    always reflects exactly what a real kiosk device would send."""
    async with httpx.AsyncClient(base_url=API_URL, timeout=10) as c:
        return await c.get(
            "/api/v1/kiosk/session",
            headers={"Authorization": f"Bearer {token}"},
        )


@pytest.mark.asyncio
async def test_valid_token_resolves_device(client):
    cashbox_id = await _create_cashbox(client)
    device = await _create_kiosk_device(client, cashbox_id)

    resp = await _kiosk_session(device["token"])
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["device_id"] == device["id"]
    assert body["device_name"] == device["name"]
    assert body["cashbox_id"] == cashbox_id
    assert body["max_cart_amount"] is None  # app_settings['kiosk'] unset for this org


@pytest.mark.asyncio
async def test_revoked_token_401(client):
    cashbox_id = await _create_cashbox(client)
    device = await _create_kiosk_device(client, cashbox_id)

    ok = await _kiosk_session(device["token"])
    assert ok.status_code == 200, ok.text

    await _revoke_kiosk_device(client, device["id"])

    revoked_resp = await _kiosk_session(device["token"])
    assert revoked_resp.status_code == 401

    unknown_resp = await _kiosk_session("kiosk_" + uuid.uuid4().hex)
    assert unknown_resp.status_code == 401
    assert revoked_resp.json()["detail"] == unknown_resp.json()["detail"], (
        "revoked and unknown tokens must 401 with the exact same generic "
        "message — the caller must not be able to distinguish the reason"
    )


@pytest.mark.asyncio
async def test_unknown_token_401():
    resp = await _kiosk_session("kiosk_" + uuid.uuid4().hex)
    assert resp.status_code == 401
    assert "detail" in resp.json()

    no_prefix_resp = await _kiosk_session(uuid.uuid4().hex)
    assert no_prefix_resp.status_code == 401

    async with httpx.AsyncClient(base_url=API_URL, timeout=10) as c:
        bare = await c.get("/api/v1/kiosk/session")
    assert bare.status_code == 401


@pytest.mark.asyncio
async def test_rotate_invalidates_old_token_immediately(client):
    cashbox_id = await _create_cashbox(client)
    device = await _create_kiosk_device(client, cashbox_id)
    old_token = device["token"]

    rotated = await _rotate_kiosk_device(client, device["id"])
    new_token = rotated["token"]
    assert new_token != old_token
    assert rotated["token_prefix"] == new_token[:9]

    old_resp = await _kiosk_session(old_token)
    assert old_resp.status_code == 401, "old token must be dead on the very next request (no grace period)"

    new_resp = await _kiosk_session(new_token)
    assert new_resp.status_code == 200, new_resp.text
    assert new_resp.json()["device_id"] == device["id"]
