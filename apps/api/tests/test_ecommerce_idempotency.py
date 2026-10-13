"""
Idempotency protection for the two ecommerce mutating endpoints that call
sale/service.py::create_sale_core() (real stock deduction + accounting):

    POST /api/v1/customer-portal/me/orders   (B2B portal order)
    POST /api/v1/shop/checkout               (B2C anonymous checkout)

Neither endpoint can send X-Organization-Id: the portal derives org purely
from the customer JWT (customer_portal/auth.py::get_current_customer), and
the storefront is fully anonymous — org is resolved from org_code in the
JSON body (storefront/service.py::resolve_org_by_code). IdempotencyMiddleware
falls back to path-specific org resolution for these two routes only; every
other whitelisted path is unaffected.

This file does NOT use the shared `client`/`auth_token`/`org_id` fixtures in
conftest.py — those assume an email-based /auth/login contract
({"email": ..., "password": ...}) that no longer matches the API's actual
phone-based LoginRequest ({"phone": ..., "password": ...}). That mismatch
pre-dates this change (confirmed: the existing test_idempotency.py fails the
exact same way on main, before any of this ticket's edits). Fixing the
shared fixture is out of scope here — a fresh org/admin is registered
per test via the real phone+OTP /auth/register flow instead.

Run inside the container:
    docker exec erp-api python -m pytest tests/test_ecommerce_idempotency.py -v
"""
import random
import uuid

import asyncpg
import httpx
import pytest


API_URL = "http://localhost:8000"


@pytest.fixture(autouse=True)
def _clean_integrations():
    """Shadow conftest.py's autouse fixture of the same name.

    The shared one depends on `auth_token`/`org_id`, which both assume a
    stale email-based /auth/login contract (see module docstring) and would
    error out before every single test in this file even runs. This file's
    own helpers register their own orgs and never touch the fixtures being
    shadowed, so a no-op override is correct here.
    """
    yield
_PG_DSN = "postgresql://erp:erp@erp-postgres:5432/erp"


def _rand_phone() -> str:
    return "+998" + "".join(str(random.randint(0, 9)) for _ in range(9))


def _rand_org_code() -> str:
    return "TST" + uuid.uuid4().hex[:10].upper()


async def _pg() -> asyncpg.Connection:
    return await asyncpg.connect(_PG_DSN)


async def _register_admin(org_name: str) -> dict:
    """Register a brand-new org + admin user via the real phone+OTP flow,
    then fix the org's public `code` to a predictable UPPERCASE value.

    /auth/register auto-generates a LOWERCASE code ("org-<hex>"), but every
    public lookup (storefront.resolve_org_by_code, customer_portal's OTP
    endpoints, and now the idempotency middleware's shop-checkout fallback)
    does `code = :c` with `:c = org_code.upper()` — a lowercase stored code
    can never match. There is no API to change `code`, so this test-only
    fixup goes directly through SQL (same pattern conftest.py already uses
    for direct DB setup/teardown).
    """
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
                "full_name": "QA Bot",
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

    org_code = _rand_org_code()
    conn = await _pg()
    try:
        await conn.execute("UPDATE organizations SET code = $1 WHERE id = $2", org_code, org_id)
    finally:
        await conn.close()

    return {
        "token": token,
        "org_id": org_id,
        "org_code": org_code,
        "headers": {"Authorization": f"Bearer {token}", "X-Organization-Id": org_id},
    }


async def _setup_online_shop(admin: dict) -> dict:
    """Create a published product with stock, and point app_settings.ecommerce
    at the default warehouse — both /shop/checkout and the B2B portal order
    endpoint read that same setting via sale/service.py::get_online_warehouse_id().
    """
    async with httpx.AsyncClient(base_url=API_URL, timeout=10) as c:
        whs = await c.get("/api/v1/warehouse/warehouses", headers=admin["headers"])
        assert whs.status_code == 200, whs.text
        warehouse_id = whs.json()[0]["id"]

        prod = await c.post(
            "/api/v1/warehouse/products",
            headers=admin["headers"],
            json={
                "name": "Idempotency test widget",
                "sale_price": "10000",
                "is_published_online": True,
            },
        )
        assert prod.status_code == 201, prod.text
        product_id = prod.json()["id"]

        setting = await c.put(
            "/api/v1/settings/key/ecommerce",
            headers=admin["headers"],
            json={"value": {"online_warehouse_id": warehouse_id}},
        )
        assert setting.status_code == 200, setting.text

    conn = await _pg()
    try:
        await conn.execute(
            "INSERT INTO stock_balances (warehouse_id, product_id, quantity, avg_cost) "
            "VALUES ($1, $2, 1000, 5000) "
            "ON CONFLICT (warehouse_id, product_id) "
            "DO UPDATE SET quantity = stock_balances.quantity + 1000",
            warehouse_id,
            product_id,
        )
    finally:
        await conn.close()

    return {"warehouse_id": warehouse_id, "product_id": product_id}


async def _sales_count(org_id: str) -> int:
    conn = await _pg()
    try:
        return await conn.fetchval(
            "SELECT COUNT(*) FROM sales WHERE organization_id = $1", org_id
        )
    finally:
        await conn.close()


async def _create_customer(admin: dict, phone: str) -> str:
    async with httpx.AsyncClient(base_url=API_URL, timeout=10) as c:
        r = await c.post(
            "/api/v1/customer/customers",
            headers=admin["headers"],
            json={"name": "Portal QA Customer", "phone": phone},
        )
        assert r.status_code == 201, r.text
        return r.json()["id"]


async def _portal_login(org_code: str, phone: str) -> str:
    async with httpx.AsyncClient(base_url=API_URL, timeout=10) as c:
        otp = await c.post(
            "/api/v1/customer-portal/auth/request-otp",
            json={"phone": phone, "org_code": org_code},
        )
        assert otp.status_code == 200, otp.text
        dev_code = otp.json()["dev_code"]

        verify = await c.post(
            "/api/v1/customer-portal/auth/verify",
            json={"phone": phone, "code": dev_code, "org_code": org_code},
        )
        assert verify.status_code == 200, verify.text
        return verify.json()["access_token"]


# ---------------------------------------------------------------------------
# The two new ecommerce endpoints: replay prevents a duplicate real sale,
# conflict (same key, different body) is rejected without ever calling
# create_sale_core again.
# ---------------------------------------------------------------------------

async def test_ecommerce_endpoints_are_idempotency_protected():
    admin = await _register_admin("EC Idempotency Test Org")
    shop = await _setup_online_shop(admin)

    async with httpx.AsyncClient(base_url=API_URL, timeout=20) as c:
        # --- B2C anonymous storefront checkout ---------------------------
        ikey_shop = str(uuid.uuid4())
        checkout_body = {
            "org_code": admin["org_code"],
            "customer": {"name": "Guest Buyer", "phone": _rand_phone()},
            "items": [{"product_id": shop["product_id"], "quantity": 1}],
            "notes": None,
        }
        r1 = await c.post(
            "/api/v1/shop/checkout",
            json=checkout_body,
            headers={"Idempotency-Key": ikey_shop},
        )
        assert r1.status_code == 201, r1.text
        assert r1.headers.get("X-Idempotency-Replayed") == "false"
        body1 = r1.json()
        assert set(body1.keys()) == {
            "sale_id", "order_number", "status", "total_amount", "payment",
        }

        # Exact same key + exact same body -> replayed, NOT a second sale.
        r2 = await c.post(
            "/api/v1/shop/checkout",
            json=checkout_body,
            headers={"Idempotency-Key": ikey_shop},
        )
        assert r2.status_code == 201
        assert r2.headers.get("X-Idempotency-Replayed") == "true"
        assert r2.json() == body1

        assert await _sales_count(admin["org_id"]) == 1

        # Same key, different body -> 409 conflict, still no second sale.
        conflicting_body = dict(checkout_body)
        conflicting_body["customer"] = {"name": "Different Buyer", "phone": _rand_phone()}
        r3 = await c.post(
            "/api/v1/shop/checkout",
            json=conflicting_body,
            headers={"Idempotency-Key": ikey_shop},
        )
        assert r3.status_code == 409
        assert r3.json()["code"] == "IDEMPOTENCY_CONFLICT"
        assert await _sales_count(admin["org_id"]) == 1

        # --- B2B customer portal order (JWT-only, no X-Organization-Id) --
        customer_phone = _rand_phone()
        await _create_customer(admin, customer_phone)
        portal_token = await _portal_login(admin["org_code"], customer_phone)
        portal_headers = {"Authorization": f"Bearer {portal_token}"}
        assert "X-Organization-Id" not in portal_headers  # confirms the anonymous-org scenario

        ikey_portal = str(uuid.uuid4())
        order_body = {
            "items": [{"product_id": shop["product_id"], "quantity": 1}],
            "notes": None,
        }
        r4 = await c.post(
            "/api/v1/customer-portal/me/orders",
            json=order_body,
            headers={**portal_headers, "Idempotency-Key": ikey_portal},
        )
        assert r4.status_code == 201, r4.text
        assert r4.headers.get("X-Idempotency-Replayed") == "false"
        body4 = r4.json()
        assert set(body4.keys()) == {"id", "order_number", "total", "status"}

        r5 = await c.post(
            "/api/v1/customer-portal/me/orders",
            json=order_body,
            headers={**portal_headers, "Idempotency-Key": ikey_portal},
        )
        assert r5.status_code == 201
        assert r5.headers.get("X-Idempotency-Replayed") == "true"
        assert r5.json() == body4

        # One sale from checkout + one from the portal order = 2 total.
        assert await _sales_count(admin["org_id"]) == 2

        # Same portal key, different body -> conflict, no third sale.
        conflicting_order = {
            "items": [{"product_id": shop["product_id"], "quantity": 1}],
            "notes": "changed my mind",
        }
        r6 = await c.post(
            "/api/v1/customer-portal/me/orders",
            json=conflicting_order,
            headers={**portal_headers, "Idempotency-Key": ikey_portal},
        )
        assert r6.status_code == 409
        assert r6.json()["code"] == "IDEMPOTENCY_CONFLICT"
        assert await _sales_count(admin["org_id"]) == 2


# ---------------------------------------------------------------------------
# Regression: the 15 pre-existing header-based whitelisted paths must keep
# working exactly as before (replay, conflict, cross-org isolation).
# ---------------------------------------------------------------------------

async def test_existing_header_based_whitelist_path_still_works_and_is_org_isolated():
    org_b = await _register_admin("Regression Org B")
    org_c = await _register_admin("Regression Org C")
    shop_b = await _setup_online_shop(org_b)

    async with httpx.AsyncClient(base_url=API_URL, timeout=20) as c:
        currencies = await c.get(
            "/api/v1/reference/currencies", headers=org_b["headers"]
        )
        assert currencies.status_code == 200, currencies.text
        currency_id = currencies.json()[0]["id"]

        ikey = str(uuid.uuid4())
        sale_body = {
            "warehouse_id": shop_b["warehouse_id"],
            "currency_id": currency_id,
            "items": [{"product_id": shop_b["product_id"], "quantity": 1, "price": "10000"}],
        }

        r1 = await c.post(
            "/api/v1/sale/sales",
            json=sale_body,
            headers={**org_b["headers"], "Idempotency-Key": ikey},
        )
        assert r1.status_code == 201, r1.text
        body1 = r1.json()

        # Replay: same org, same key, same body -> cached hit, no 2nd sale.
        r2 = await c.post(
            "/api/v1/sale/sales",
            json=sale_body,
            headers={**org_b["headers"], "Idempotency-Key": ikey},
        )
        assert r2.status_code == 201
        assert r2.headers.get("X-Idempotency-Replayed") == "true"
        assert r2.json() == body1
        assert await _sales_count(org_b["org_id"]) == 1

        # Conflict: same org, same key, different body -> 409.
        conflict_body = dict(sale_body)
        conflict_body["items"] = [
            {"product_id": shop_b["product_id"], "quantity": 2, "price": "10000"}
        ]
        r3 = await c.post(
            "/api/v1/sale/sales",
            json=conflict_body,
            headers={**org_b["headers"], "Idempotency-Key": ikey},
        )
        assert r3.status_code == 409
        assert r3.json()["code"] == "IDEMPOTENCY_CONFLICT"
        assert await _sales_count(org_b["org_id"]) == 1

        # Cross-org isolation: org C reusing org B's exact key must NOT get
        # org B's cached response (different org -> 400, since org C has no
        # such warehouse/product — the important assertion is that it is
        # never a replay of org B's data).
        r4 = await c.post(
            "/api/v1/sale/sales",
            json=sale_body,
            headers={**org_c["headers"], "Idempotency-Key": ikey},
        )
        assert r4.headers.get("X-Idempotency-Replayed") != "true"
        assert r4.json() != body1
        assert await _sales_count(org_c["org_id"]) == 0
