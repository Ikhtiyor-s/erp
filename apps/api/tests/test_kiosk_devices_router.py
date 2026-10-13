"""SC-2 — admin provisioning CRUD for kiosk device credentials
(/api/v1/kiosk-devices, staff JWT + RBAC).

Acceptance tests named per tickets/DESIGN-self-checkout-auth.md's own test
list.

Run inside the container:
    docker exec erp-api python -m pytest tests/test_kiosk_devices_router.py -v
"""
import random
import uuid

import asyncpg
import httpx
import pytest

from app.core.security import hash_password


API_URL = "http://localhost:8000"
_PG_DSN = "postgresql://erp:erp@erp-postgres:5432/erp"


def _rand_phone() -> str:
    return "+998" + "".join(str(random.randint(0, 9)) for _ in range(9))


def _rand_org_code() -> str:
    return "TST" + uuid.uuid4().hex[:10].upper()


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
            "name": f"KD Test Cashbox {uuid.uuid4().hex[:8]}",
            "currency_id": currency_id,
            "warehouse_id": warehouse_id,
        },
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


async def _register_admin(org_name: str) -> dict:
    """Register a brand-new org + admin via the real phone+OTP flow (same
    helper pattern as test_ecommerce_idempotency.py::_register_admin)."""
    phone = _rand_phone()
    async with httpx.AsyncClient(base_url=API_URL, timeout=10) as c:
        otp = await c.post("/api/v1/auth/register/request-otp", json={"phone": phone})
        assert otp.status_code == 200, otp.text
        dev_code = otp.json()["dev_code"]

        verify = await c.post(
            "/api/v1/auth/register/verify-otp", json={"phone": phone, "code": dev_code}
        )
        assert verify.status_code == 200, verify.text
        ticket = verify.json()["ticket"]

        reg = await c.post(
            "/api/v1/auth/register",
            json={
                "ticket": ticket,
                "phone": phone,
                "password": "TestPass123!",
                "full_name": "QA Bot Org B",
                "organization_name": org_name,
            },
        )
        assert reg.status_code == 201, reg.text
        token = reg.json()["access_token"]

        orgs = await c.get(
            "/api/v1/organizations/mine", headers={"Authorization": f"Bearer {token}"}
        )
        assert orgs.status_code == 200, orgs.text
        org_id = orgs.json()[0]["id"]

    return {
        "org_id": org_id,
        "headers": {"Authorization": f"Bearer {token}", "X-Organization-Id": org_id},
    }


@pytest.mark.asyncio
async def test_create_requires_kiosk_create_permission(client, org_id):
    """A real member of the org whose role carries zero kiosk.* permissions
    must get 403 on POST /kiosk-devices (not silently succeed, not 401)."""
    cashbox_id = await _create_cashbox(client)

    role_resp = await client.post(
        "/api/v1/rbac/roles",
        json={
            "code": f"kiosktest{uuid.uuid4().hex[:8]}",
            "name": "No Kiosk Perms (test)",
            "permission_ids": [],
        },
    )
    assert role_resp.status_code == 201, role_resp.text
    role_id = role_resp.json()["id"]

    phone = _rand_phone()
    password = "NoKioskPerms123!"
    conn = await asyncpg.connect(_PG_DSN)
    try:
        user_id = await conn.fetchval(
            "INSERT INTO users (phone, password_hash, full_name) "
            "VALUES ($1, $2, $3) RETURNING id",
            phone, hash_password(password), "No Kiosk Perms Test User",
        )
        await conn.execute(
            "INSERT INTO user_organizations (user_id, organization_id, role_id, is_default) "
            "VALUES ($1, $2, $3, FALSE)",
            user_id, org_id, role_id,
        )
    finally:
        await conn.close()

    async with httpx.AsyncClient(base_url=API_URL, timeout=10) as c:
        login = await c.post("/api/v1/auth/login", json={"phone": phone, "password": password})
        assert login.status_code == 200, login.text
        limited_token = login.json()["access_token"]

        resp = await c.post(
            "/api/v1/kiosk-devices",
            headers={"Authorization": f"Bearer {limited_token}", "X-Organization-Id": org_id},
            json={"name": "Should Not Be Created", "cashbox_id": cashbox_id},
        )
    assert resp.status_code == 403, resp.text


@pytest.mark.asyncio
async def test_token_shown_once_not_in_list_response(client):
    cashbox_id = await _create_cashbox(client)

    create = await client.post(
        "/api/v1/kiosk-devices",
        json={"name": f"List Test Device {uuid.uuid4().hex[:8]}", "cashbox_id": cashbox_id},
    )
    assert create.status_code == 201, create.text
    body = create.json()
    assert body["token"].startswith("kiosk_")
    assert body["token_prefix"] == body["token"][:9]

    listing = await client.get("/api/v1/kiosk-devices")
    assert listing.status_code == 200, listing.text
    rows = {row["id"]: row for row in listing.json()}
    assert body["id"] in rows
    row = rows[body["id"]]
    assert "token" not in row, "plaintext token must never appear in the list response"
    assert "token_hash" not in row, "token_hash must never appear in any API response"
    assert row["token_prefix"] == body["token_prefix"]
    assert row["cashbox_id"] == cashbox_id

    rotate = await client.post(f"/api/v1/kiosk-devices/{body['id']}/rotate")
    assert rotate.status_code == 200, rotate.text
    rotated = rotate.json()
    assert rotated["token"].startswith("kiosk_")
    assert rotated["token"] != body["token"]

    listing_after_rotate = await client.get("/api/v1/kiosk-devices")
    assert listing_after_rotate.status_code == 200, listing_after_rotate.text
    for item in listing_after_rotate.json():
        assert "token" not in item
        assert "token_hash" not in item


@pytest.mark.asyncio
async def test_cross_tenant_isolation(client):
    """Org B admin cannot view/rotate/revoke Org A's kiosk device — every
    cross-tenant attempt must 404 (never 403, which would confirm existence)."""
    cashbox_id = await _create_cashbox(client)
    device = await client.post(
        "/api/v1/kiosk-devices",
        json={"name": f"CrossTenant Device {uuid.uuid4().hex[:8]}", "cashbox_id": cashbox_id},
    )
    assert device.status_code == 201, device.text
    device_id = device.json()["id"]

    org_b = await _register_admin(f"Org B {uuid.uuid4().hex[:8]}")

    async with httpx.AsyncClient(base_url=API_URL, timeout=10) as c:
        listing = await c.get("/api/v1/kiosk-devices", headers=org_b["headers"])
        assert listing.status_code == 200, listing.text
        assert device_id not in {row["id"] for row in listing.json()}

        rotate = await c.post(
            f"/api/v1/kiosk-devices/{device_id}/rotate", headers=org_b["headers"]
        )
        assert rotate.status_code == 404, rotate.text

        put = await c.put(
            f"/api/v1/kiosk-devices/{device_id}",
            headers=org_b["headers"],
            json={"name": "Hijacked", "cashbox_id": cashbox_id},
        )
        assert put.status_code == 404, put.text

        revoke = await c.delete(
            f"/api/v1/kiosk-devices/{device_id}", headers=org_b["headers"]
        )
        assert revoke.status_code == 404, revoke.text

    # Org A's device must be completely untouched by Org B's attempts.
    still_there = await client.get("/api/v1/kiosk-devices")
    assert still_there.status_code == 200, still_there.text
    own_row = next(row for row in still_there.json() if row["id"] == device_id)
    assert own_row["status"] == "active"
    assert own_row["name"] == device.json()["name"]
