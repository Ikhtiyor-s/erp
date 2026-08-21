"""Customer portal OTP flow + customer-facing endpoints."""
import pytest
import httpx


API_URL = "http://localhost:8000"


@pytest.fixture
def portal_client():
    return httpx.AsyncClient(base_url=API_URL, timeout=10)


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
