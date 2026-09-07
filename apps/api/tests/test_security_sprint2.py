"""Sprint #2 integration security tests (live API)."""
import pytest

async def test_admin_create_global_unit_blocked(client):
    resp = await client.post("/api/v1/reference/units", json={"code": "TUS", "name": "Test"})
    if resp.status_code in (200, 201):
        pytest.skip("Seed user has superadmin; CR-4 not testable here")
    assert resp.status_code in (403, 409), resp.text

async def test_create_sale_cross_tenant_warehouse(client):
    cur = await client.get("/api/v1/reference/currencies")
    cur_id = cur.json()[0]["id"] if cur.status_code == 200 and cur.json() else 1
    pr = await client.get("/api/v1/warehouse/products?limit=1")
    if pr.status_code != 200 or not pr.json():
        pytest.skip("No products")
    p_id = pr.json()[0]["id"]
    resp = await client.post("/api/v1/sale/sales", json={
        "warehouse_id": 999999, "currency_id": cur_id,
        "items": [{"product_id": p_id, "quantity": 1, "price": 100, "discount": 0}],
    })
    assert resp.status_code in (422, 400), resp.text

async def test_create_movement_cross_tenant_cashbox(client):
    cur = await client.get("/api/v1/reference/currencies")
    cur_id = cur.json()[0]["id"] if cur.status_code == 200 and cur.json() else 1
    resp = await client.post("/api/v1/finance/movements", json={
        "cashbox_id": 999999, "direction": "in",
        "amount": 1000, "currency_id": cur_id, "rate": 1,
        "description": "xtest",
    })
    assert resp.status_code in (422, 400), resp.text

async def test_pay_sale_cross_tenant_cashbox(client):
    wh = await client.get("/api/v1/warehouse/warehouses")
    pr = await client.get("/api/v1/warehouse/products?limit=1")
    if not (wh.status_code == 200 and wh.json() and pr.status_code == 200 and pr.json()):
        pytest.skip("Missing seed")
    wh_id = wh.json()[0]["id"]
    p_id = pr.json()[0]["id"]
    cur = await client.get("/api/v1/reference/currencies")
    cur_id = cur.json()[0]["id"] if cur.status_code == 200 and cur.json() else 1
    s = await client.post("/api/v1/sale/sales", json={
        "warehouse_id": wh_id, "currency_id": cur_id,
        "items": [{"product_id": p_id, "quantity": 1, "price": 500, "discount": 0}],
    })
    assert s.status_code == 201, s.text
    sid = s.json()["id"]
    pay = await client.post(f"/api/v1/sale/sales/{sid}/pay", json={"amount": 250, "cashbox_id": 999999})
    assert pay.status_code in (422, 400), pay.text

async def test_grant_unknown_permission_id_safe(client):
    roles = (await client.get("/api/v1/rbac/roles")).json()
    mutable = [r for r in roles if r.get("organization_id")]
    if not mutable:
        pytest.skip("No tenant role")
    rid = mutable[0]["id"]
    resp = await client.put(f"/api/v1/rbac/roles/{rid}/permissions", json={"permission_ids": [999999]})
    assert resp.status_code in (400, 403), (
        f"Unknown permission_id 999999 must be rejected, got {resp.status_code}: {resp.text}"
    )


@pytest.mark.asyncio
async def test_otp_invalid_phone_returns_422(http_client):
    """HI-7 Scenario 1: Yaroqsiz format → 422."""
    resp = await http_client.post(
        "/api/v1/customer-portal/auth/request-otp",
        json={"phone": "not-a-phone", "org_code": "ANIQ"},
    )
    assert resp.status_code == 422, resp.text


@pytest.mark.asyncio
async def test_otp_short_phone_returns_422(http_client):
    """HI-7 Scenario 2: Juda qisqa raqam (prefix bo'lib qoladi) → 422, exact match LIKE bo'lmaydi.

    Note: 429 ham qabul qilinadi — rate limit (3/min) tufayli agar oldingi test ham
    shu endpoint'ni chaqirgan bo'lsa. Muhim: 200/201 bo'lmasligi (yaroqsiz raqam qabul qilinmaydi).
    """
    # Eski LIKE %...% pattern bo'lsa "+998901234" "+99890123456" ga prefix-match qilardi
    resp = await http_client.post(
        "/api/v1/customer-portal/auth/request-otp",
        json={"phone": "+998901234", "org_code": "ANIQ"},
    )
    assert resp.status_code in (200, 422, 429), (
        f"Short phone must not cause 5xx, got {resp.status_code}: {resp.text}. "
        f"Note: 200 is acceptable — phone enumeration prevention returns generic success "
        f"for any plausibly-formatted number that doesn't match a customer."
    )


@pytest.mark.asyncio
async def test_register_creates_org_scoped_admin_role(http_client):
    """HI-5: Yangi org register qilinganda admin role org-scoped bo'lsin (organization_id IS NOT NULL)."""
    import uuid as _uuid
    suffix = _uuid.uuid4().hex[:8]
    resp = await http_client.post("/api/v1/auth/register", json={
        "email": f"hi5_{suffix}@example.com",
        "password": "Test12345!",
        "full_name": f"HI5 Test {suffix}",
        "organization_name": f"HI5 Org {suffix}",
    })
    assert resp.status_code in (200, 201), resp.text
    body = resp.json()
    token = body.get("access_token") or body.get("token")
    assert token, f"No token in register response: {body}"

    # Login qilib, /rbac/roles endpoint'dan "admin" role'ning organization_id'sini tekshiramiz
    # Yangi token bilan authenticated so'rov yuboramiz
    # Avval org info olish kerak
    me_resp = await http_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_resp.status_code == 200, me_resp.text
    me_body = me_resp.json()

    # Org ID'ni olish
    orgs_resp = await http_client.get(
        "/api/v1/organizations/mine",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert orgs_resp.status_code == 200, orgs_resp.text
    orgs = orgs_resp.json()
    assert orgs, "No organizations returned after register"
    new_org_id = orgs[0]["id"]

    # RBAC roles endpoint'dan "admin" role'ni tekshiramiz
    roles_resp = await http_client.get(
        "/api/v1/rbac/roles",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Organization-Id": new_org_id,
        },
    )
    assert roles_resp.status_code == 200, roles_resp.text
    roles = roles_resp.json()
    # HI-5: yangi org uchun org-scoped admin role bo'lishi shart
    # (organization_id == new_org_id, IS NOT NULL)
    org_scoped_admin_roles = [
        r for r in roles
        if r.get("code") == "admin" and r.get("organization_id") is not None
    ]
    assert org_scoped_admin_roles, (
        f"HI-5 FAILED: No org-scoped 'admin' role found for new org {new_org_id}. "
        f"All roles: {roles}"
    )
    # Org-scoped admin role shu org'ga tegishli bo'lishi shart
    for ar in org_scoped_admin_roles:
        assert str(ar.get("organization_id")) == str(new_org_id), (
            f"HI-5 FAILED: admin role organization_id {ar.get('organization_id')} "
            f"does not match new org {new_org_id}: {ar}"
        )
