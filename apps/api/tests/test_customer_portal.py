"""Customer portal OTP flow + customer-facing endpoints."""
import os
import random
import uuid

import pytest
import httpx


API_URL = "http://localhost:8000"


@pytest.fixture
def portal_client():
    return httpx.AsyncClient(base_url=API_URL, timeout=10)


def _rand_phone() -> str:
    return "+998" + "".join(str(random.randint(0, 9)) for _ in range(9))


def _reset_otp_rate_limit() -> None:
    """Clear the real /customer-portal/auth/request-otp endpoint's 3/minute
    counter for 127.0.0.1 (same Redis key pattern conftest.py's own
    `_reset_test_rate_limits` resets once per session). This file's other
    tests plus test_ecommerce_idempotency.py already share that tight
    budget; the new real-OTP E2E test below adds one more call to it, so it
    resets the counter after itself to avoid starving whichever OTP test
    happens to run next in the full suite — a timing/shared-budget concern,
    not a logic bug."""
    try:
        import redis as _redis
        r = _redis.from_url(os.environ.get("REDIS_URL", "redis://redis:6379/0"), socket_connect_timeout=2)
        keys = r.keys("LIMITS:LIMITER/127.0.0.1//api/v1/customer-portal/auth/request-otp/*")
        if keys:
            r.delete(*keys)
    except Exception:
        pass


@pytest.fixture
def _otp_rate_limit_guard():
    _reset_otp_rate_limit()
    yield
    _reset_otp_rate_limit()


async def test_request_otp_for_unknown_phone_returns_ok(portal_client):
    """For privacy, unknown phones still get 'OK' (no enumeration)."""
    async with portal_client as c:
        resp = await c.post(
            "/api/v1/customer-portal/auth/request-otp",
            json={"phone": "+998999999999", "org_code": "ANIQ"},
        )
        assert resp.status_code == 200
        assert resp.json()["ok"] is True


async def test_request_otp_unknown_org_returns_404(portal_client):
    async with portal_client as c:
        resp = await c.post(
            "/api/v1/customer-portal/auth/request-otp",
            json={"phone": "+998900000000", "org_code": "NOPE"},
        )
        assert resp.status_code == 404


async def test_full_otp_login_flow(portal_client):
    """Request OTP for a real customer, retrieve dev_code, verify."""
    # First, fetch a real customer phone from the admin API
    async with httpx.AsyncClient(base_url=API_URL, timeout=10) as admin:
        login = await admin.post("/api/v1/auth/login",
                                 json={"email": "qa@example.com", "password": "Qa12345!"})
        token = login.json()["access_token"]
        orgs = await admin.get("/api/v1/organizations/mine",
                                headers={"Authorization": f"Bearer {token}"})
        org_id = next(o["id"] for o in orgs.json() if o["code"] == "ANIQ")

        cust = await admin.get(
            "/api/v1/customer/customers?limit=1",
            headers={"Authorization": f"Bearer {token}",
                     "X-Organization-Id": org_id},
        )
        customers = cust.json()
        if not customers:
            pytest.skip("No customers in seed")
        phone = customers[0].get("phone")
        if not phone:
            pytest.skip("Test customer has no phone")

    async with portal_client as c:
        # Request OTP
        otp_resp = await c.post(
            "/api/v1/customer-portal/auth/request-otp",
            json={"phone": phone, "org_code": "ANIQ"},
        )
        assert otp_resp.status_code == 200
        data = otp_resp.json()
        # In dev mode without SMS provider, code is returned
        if "dev_code" not in data:
            pytest.skip("SMS provider configured — can't retrieve OTP in test")
        otp_code = data["dev_code"]

        # Verify
        verify = await c.post(
            "/api/v1/customer-portal/auth/verify",
            json={"phone": phone, "code": otp_code, "org_code": "ANIQ"},
        )
        assert verify.status_code == 200, verify.text
        token_data = verify.json()
        assert "access_token" in token_data
        assert "customer" in token_data

        portal_token = token_data["access_token"]
        headers = {"Authorization": f"Bearer {portal_token}"}

        # /me/balance
        bal = await c.get("/api/v1/customer-portal/me/balance", headers=headers)
        assert bal.status_code == 200
        for key in ("total_purchases", "total_paid", "debt", "sale_count"):
            assert key in bal.json()

        # /me/sales
        sales = await c.get("/api/v1/customer-portal/me/sales", headers=headers)
        assert sales.status_code == 200
        assert isinstance(sales.json(), list)


async def test_portal_endpoints_require_customer_token(portal_client):
    """Admin token must NOT work on portal endpoints (different signing secret)."""
    async with httpx.AsyncClient(base_url=API_URL, timeout=10) as admin:
        login = await admin.post(
            "/api/v1/auth/login",
            json={"email": "qa@example.com", "password": "Qa12345!"},
        )
        admin_token = login.json()["access_token"]

    async with portal_client as c:
        resp = await c.get(
            "/api/v1/customer-portal/me/balance",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 401, "Admin token must be rejected by portal"


# ---------------------------------------------------------------------------
# REAL end-to-end — POST /customer-portal/me/orders
#
# Uses conftest.py's `client`/`org_id` fixtures (the session's self-registered
# phone-based admin+org) for setup/verification, NOT the email-based
# /auth/login path the two tests above (test_full_otp_login_flow,
# test_portal_endpoints_require_customer_token) use — that path is the
# pre-existing, out-of-scope bug flagged separately. The customer-facing side
# of this test still goes through the real phone+OTP
# request-otp/verify flow (customer_portal/auth.py), same as every other
# test in this file.
# ---------------------------------------------------------------------------

async def _setup_online_warehouse_and_product(client: httpx.AsyncClient, qty: str) -> dict:
    whs = await client.get("/api/v1/warehouse/warehouses")
    assert whs.status_code == 200, whs.text
    warehouse_id = whs.json()[0]["id"]

    setting = await client.put(
        "/api/v1/settings/key/ecommerce",
        json={"value": {"online_warehouse_id": warehouse_id}},
    )
    assert setting.status_code == 200, setting.text

    name = f"Portal Order E2E Widget {uuid.uuid4().hex[:8]}"
    prod = await client.post(
        "/api/v1/warehouse/products",
        json={"name": name, "sale_price": "12000"},
    )
    assert prod.status_code == 201, prod.text
    product_id = prod.json()["id"]

    stock_in = await client.post(
        "/api/v1/warehouse/stock-ins",
        json={
            "warehouse_id": warehouse_id,
            "items": [{"product_id": product_id, "quantity": qty, "unit_cost": "6000"}],
        },
    )
    assert stock_in.status_code == 201, stock_in.text
    confirm = await client.post(f"/api/v1/warehouse/stock-ins/{stock_in.json()['id']}/confirm")
    assert confirm.status_code == 200, confirm.text

    return {"warehouse_id": warehouse_id, "product_id": product_id}


async def test_customer_portal_create_order_real_e2e(client, org_id, _otp_rate_limit_guard):
    """Real HTTP, no mocks: a real phone+OTP customer login places a real
    POST /customer-portal/me/orders order -> hands off to
    sale/service.py::create_sale_core() for real. Asserts a real `sales` row
    was created (visible via the admin /sale/sales list), stock really
    decreased (/warehouse/stock), and the order appears in
    GET /customer-portal/me/sales."""
    shop = await _setup_online_warehouse_and_product(client, qty="5")

    orgs = await client.get("/api/v1/organizations/mine")
    assert orgs.status_code == 200, orgs.text
    org_code = next(o["code"] for o in orgs.json() if o["id"] == org_id)

    customer_phone = _rand_phone()
    cust = await client.post(
        "/api/v1/customer/customers",
        json={"name": "Portal E2E Customer", "phone": customer_phone},
    )
    assert cust.status_code == 201, cust.text
    customer_id = cust.json()["id"]

    async with httpx.AsyncClient(base_url=API_URL, timeout=10) as portal:
        otp = await portal.post(
            "/api/v1/customer-portal/auth/request-otp",
            json={"phone": customer_phone, "org_code": org_code},
        )
        assert otp.status_code == 200, otp.text
        dev_code = otp.json()["dev_code"]

        verify = await portal.post(
            "/api/v1/customer-portal/auth/verify",
            json={"phone": customer_phone, "code": dev_code, "org_code": org_code},
        )
        assert verify.status_code == 200, verify.text
        verify_body = verify.json()
        assert verify_body["customer"]["id"] == customer_id
        portal_headers = {"Authorization": f"Bearer {verify_body['access_token']}"}

        order = await portal.post(
            "/api/v1/customer-portal/me/orders",
            json={
                "items": [{"product_id": shop["product_id"], "quantity": 2}],
                "notes": "E2E real portal order",
            },
            headers=portal_headers,
        )
        assert order.status_code == 201, order.text
        order_body = order.json()
        assert order_body["status"] == "new"
        assert order_body["total"] == 24000.0  # 12000 * 2

        my_sales = await portal.get("/api/v1/customer-portal/me/sales", headers=portal_headers)
        assert my_sales.status_code == 200, my_sales.text
        assert any(float(r["total"]) == 24000.0 for r in my_sales.json())

    sales = await client.get("/api/v1/sale/sales", params={"customer_id": customer_id})
    assert sales.status_code == 200, sales.text
    sale_rows = sales.json()
    assert len(sale_rows) == 1
    assert sale_rows[0]["status"] == "confirmed"
    assert float(sale_rows[0]["total_amount"]) == 24000.0

    balances = await client.get(
        "/api/v1/warehouse/stock", params={"warehouse_id": shop["warehouse_id"]},
    )
    assert balances.status_code == 200, balances.text
    row = next(b for b in balances.json() if b["product_id"] == shop["product_id"])
    assert float(row["quantity"]) == 3.0  # 5 stocked in - 2 ordered
