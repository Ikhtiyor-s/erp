"""MA-2: GET /push/devices (apps/api/app/modules/mobile/router.py).

Additive endpoint per tickets/DESIGN-merchant-admin.md §0 item 2 / §7 — lists
the calling user's own registered push tokens so Settings can show "N device
registered" and let the user remove a lost device. Auth-only (no permission
dependency), filtered by user_id only — same precedent as the existing
DELETE /push/{token} endpoint (mobile/router.py), not organization_id, since
a push token is a user+device owned resource, not an org-scoped business
record.

Happy path   — register a token, it shows up in the list with the right shape;
               unregistering removes it again.
Error case   — unauthenticated request is rejected.
Isolation    — a token registered by one organization's user never appears in
               another organization's user's device list (proven with a real
               second organization, not a fake id).
"""
import os
import random
import uuid

import httpx
import pytest
import pytest_asyncio

API_URL = os.environ.get("API_URL", "http://localhost:8000")

_ORG_B: dict = {}


def _rand_phone() -> str:
    return "+998" + "".join(str(random.randint(0, 9)) for _ in range(9))


async def _register_org_b() -> None:
    if "token" in _ORG_B:
        return
    async with httpx.AsyncClient(base_url=API_URL, timeout=10) as c:
        phone = _rand_phone()
        otp = await c.post("/api/v1/auth/register/request-otp", json={"phone": phone})
        assert otp.status_code == 200, otp.text
        dev_code = otp.json()["dev_code"]
        verify = await c.post(
            "/api/v1/auth/register/verify-otp", json={"phone": phone, "code": dev_code}
        )
        assert verify.status_code == 200, verify.text
        reg = await c.post("/api/v1/auth/register", json={
            "ticket": verify.json()["ticket"],
            "phone": phone,
            "password": "Qa12345!",
            "full_name": "Push Org B Admin",
            "organization_name": f"PushDevicesOrgB-{uuid.uuid4().hex[:8]}",
        })
        assert reg.status_code == 201, reg.text
        token = reg.json()["access_token"]
        orgs = await c.get(
            "/api/v1/organizations/mine", headers={"Authorization": f"Bearer {token}"}
        )
        org_id = orgs.json()[0]["id"]
        _ORG_B.update({
            "token": token,
            "org": org_id,
            "headers": {"Authorization": f"Bearer {token}", "X-Organization-Id": org_id},
        })


@pytest_asyncio.fixture
async def org_b():
    await _register_org_b()
    return _ORG_B


@pytest.mark.asyncio
async def test_push_devices_empty_list_shape(client):
    resp = await client.get("/api/v1/push/devices")
    assert resp.status_code == 200, resp.text
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_push_devices_register_then_list_then_remove(client):
    token = f"test-token-{uuid.uuid4().hex}"
    reg = await client.post(
        "/api/v1/push/register",
        json={"token": token, "platform": "android", "device_label": "Pixel 7"},
    )
    assert reg.status_code == 200, reg.text

    listed = await client.get("/api/v1/push/devices")
    assert listed.status_code == 200, listed.text
    rows = listed.json()
    match = [r for r in rows if r.get("device_label") == "Pixel 7"]
    assert len(match) == 1, rows
    row = match[0]
    assert row["platform"] == "android"
    assert isinstance(row["id"], int)
    assert isinstance(row["last_used_at"], str) and row["last_used_at"]
    assert isinstance(row["created_at"], str) and row["created_at"]

    unreg = await client.delete(f"/api/v1/push/{token}")
    assert unreg.status_code == 200, unreg.text

    listed_after = await client.get("/api/v1/push/devices")
    remaining = [r for r in listed_after.json() if r.get("device_label") == "Pixel 7"]
    assert remaining == []


@pytest.mark.asyncio
async def test_push_devices_unauthenticated_rejected(http_client):
    resp = await http_client.get("/api/v1/push/devices")
    assert resp.status_code in (401, 403), resp.text


@pytest.mark.asyncio
async def test_push_devices_cross_org_isolation(client, org_b):
    """Org B registers its own device; Org A's device list must never show it."""
    b_token = f"test-token-orgb-{uuid.uuid4().hex}"
    async with httpx.AsyncClient(
        base_url=API_URL, timeout=10, headers=org_b["headers"]
    ) as c:
        reg = await c.post(
            "/api/v1/push/register",
            json={"token": b_token, "platform": "android", "device_label": "OrgB Phone"},
        )
        assert reg.status_code == 200, reg.text

    a_listed = await client.get("/api/v1/push/devices")
    assert a_listed.status_code == 200, a_listed.text
    leaked = [r for r in a_listed.json() if r.get("device_label") == "OrgB Phone"]
    assert leaked == [], "Org A must never see Org B's registered push device"

    async with httpx.AsyncClient(
        base_url=API_URL, timeout=10, headers=org_b["headers"]
    ) as c:
        b_listed = await c.get("/api/v1/push/devices")
    assert b_listed.status_code == 200, b_listed.text
    own = [r for r in b_listed.json() if r.get("device_label") == "OrgB Phone"]
    assert len(own) == 1
