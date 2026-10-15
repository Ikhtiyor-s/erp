"""Cross-tenant org-scoping security fix for apps/api/app/modules/mobile/router.py.

Reproduces, with a genuine second organization (not a fake numeric id), that an
authenticated user from Org A could read/write Org B's data through several
mobile-module endpoints that were missing `organization_id` scoping, then
proves the fix: cross-org calls now 404/empty, legitimate same-org calls
still work unchanged.

A second org (`_org_b`) is registered once per test session (same self-register
pattern as conftest's session admin) and seeded with one of each resource type
needed below, to keep register/OTP rate-limit usage low across the file.
"""
import os
import random
import uuid

import asyncpg
import httpx
import pytest
import pytest_asyncio

API_URL = os.environ.get("API_URL", "http://localhost:8000")
_PG_DSN = os.environ.get(
    "DATABASE_URL_SYNC", "postgresql://erp:erp@erp-postgres:5432/erp",
)

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
            "full_name": "Org B Admin",
            "organization_name": f"MobileScopingOrgB-{uuid.uuid4().hex[:8]}",
        })
        assert reg.status_code == 201, reg.text
        token = reg.json()["access_token"]
        orgs = await c.get(
            "/api/v1/organizations/mine", headers={"Authorization": f"Bearer {token}"}
        )
        org_id = orgs.json()[0]["id"]
        h = {"Authorization": f"Bearer {token}", "X-Organization-Id": org_id}

        emp = await c.post("/api/v1/hr/employees", headers=h, json={"full_name": "Org B Courier"})
        assert emp.status_code == 201, emp.text
        emp_id = emp.json()["id"]

        cust = await c.post("/api/v1/customer/customers", headers=h, json={"name": "Org B Customer"})
        assert cust.status_code == 201, cust.text
        cust_id = cust.json()["id"]

        prod = await c.post(
            "/api/v1/warehouse/products", headers=h,
            json={"name": "Org B Product", "sale_price": "10000"},
        )
        assert prod.status_code == 201, prod.text
        product_id = prod.json()["id"]

        wh = await c.get("/api/v1/warehouse/warehouses", headers=h)
        wh_id = wh.json()[0]["id"]
        cur = await c.get("/api/v1/reference/currencies", headers=h)
        cur_id = cur.json()[0]["id"] if cur.status_code == 200 and cur.json() else 1

        inv = await c.post(
            "/api/v1/warehouse/inventories", headers=h,
            json={"warehouse_id": wh_id, "items": [{"product_id": product_id, "actual_qty": "50"}]},
        )
        await c.post(f"/api/v1/warehouse/inventories/{inv.json()['id']}/finish", headers=h)

        sale = await c.post(
            "/api/v1/sale/sales", headers=h,
            json={
                "warehouse_id": wh_id, "currency_id": cur_id,
                "items": [{"product_id": product_id, "quantity": 1, "price": 1000, "discount": 0}],
            },
        )
        assert sale.status_code == 201, sale.text
        sale_id = sale.json()["id"]

        plan = await c.post(
            "/api/v1/installments", headers=h,
            json={
                "sale_id": sale_id, "customer_id": cust_id, "total_amount": "1000",
                "currency_id": cur_id, "months": 2, "start_date": "2026-10-01",
            },
        )
        assert plan.status_code == 201, plan.text
        plan_id = plan.json()["id"]
        detail = await c.get(f"/api/v1/installments/{plan_id}", headers=h)
        sched_id = detail.json()["schedules"][0]["id"]

        cashbox = await c.get("/api/v1/finance/cashboxes", headers=h)
        cashbox_id = cashbox.json()[0]["id"]

        tag = await c.post("/api/v1/tags", headers=h, json={"name": "OrgB-VIP"})
        tag_id = tag.json()["id"]

        page = await c.post("/api/v1/pos-pages", headers=h, json={"name": "OrgB Page"})
        page_id = page.json()["id"]

        ticket = await c.post(
            "/api/v1/open-tickets", headers=h, json={"ticket_name": "OrgB Table 1"}
        )
        ticket_id = ticket.json()["id"]
        item = await c.post(
            f"/api/v1/open-tickets/{ticket_id}/items", headers=h,
            json={"product_id": product_id, "quantity": "1", "price": "1000"},
        )
        assert item.status_code == 200, item.text
        ticket_detail = await c.get(f"/api/v1/open-tickets/{ticket_id}", headers=h)
        item_id = ticket_detail.json()["items"][0]["id"]

        # /visits/check-in requires the caller to already have an `employees`
        # row linked to their own user_id (self-service field-rep flow), which
        # the admin test user doesn't have and the public API has no way to
        # set — insert the visit directly instead, same direct-DB-setup
        # pattern conftest.py already uses (_pin_org_code, _wipe_integration_settings).
        visit_id = str(uuid.uuid4())
        conn = await asyncpg.connect(_PG_DSN)
        try:
            await conn.execute(
                "INSERT INTO visits (id, organization_id, customer_id, employee_id) "
                "VALUES ($1, $2, $3, $4)",
                visit_id, org_id, cust_id, emp_id,
            )
        finally:
            await conn.close()

        # create_delivery_order has a pre-existing, unrelated bug: its SQL
        # reuses the :cr bind param both as a plain column value and inside
        # a CASE WHEN :cr IS NOT NULL expression, which asyncpg always
        # rejects with AmbiguousParameterError regardless of the value given.
        # Not one of this ticket's 15 listed endpoints (update_delivery_status
        # is) — flagged in the report, worked around here via direct insert.
        delivery_id = str(uuid.uuid4())
        conn = await asyncpg.connect(_PG_DSN)
        try:
            await conn.execute(
                "INSERT INTO delivery_orders (id, organization_id, order_number, "
                "customer_id, delivery_address, status) VALUES ($1, $2, $3, $4, $5, 'new')",
                delivery_id, org_id, "DLV-TEST", cust_id, "Org B st. 1",
            )
        finally:
            await conn.close()

        att = await c.post(
            f"/api/v1/attachments/customer/{cust_id}", headers=h,
            json={"file_url": "https://example.com/orgb.pdf"},
        )
        assert att.status_code == 201, att.text
        att_id = att.json()["id"]

        _ORG_B.update({
            "token": token, "org": org_id, "headers": h,
            "employee_id": emp_id, "customer_id": cust_id, "product_id": product_id,
            "plan_id": plan_id, "schedule_id": sched_id, "cashbox_id": cashbox_id,
            "tag_id": tag_id, "page_id": page_id, "ticket_id": ticket_id, "item_id": item_id,
            "visit_id": visit_id, "delivery_id": delivery_id, "attachment_id": att_id,
        })


@pytest_asyncio.fixture
async def org_b():
    """Function-scoped fixture, but backed by a module-level cache (same
    pattern as conftest's `auth_token`/`_register_session_admin`) so Org B is
    only actually registered+seeded once per test run, not once per test.
    """
    await _register_org_b()
    return _ORG_B


# ---------------------------------------------------------------------------
# pay_installment — cross-tenant financial mutation (explicit ticket example)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_pay_installment_cross_org_blocked(client, org_b):
    """Org A (own legit header) must not be able to pay down Org B's installment plan."""
    resp = await client.post(
        f"/api/v1/installments/{org_b['plan_id']}/pay",
        json={"schedule_id": org_b["schedule_id"], "amount": "100"},
    )
    assert resp.status_code == 404, resp.text

    # Org B's plan must remain untouched by the blocked attempt.
    detail = await client.get(
        f"/api/v1/installments/{org_b['plan_id']}", headers=org_b["headers"]
    )
    assert detail.status_code == 200
    assert float(detail.json()["paid_amount"]) == 0.0


@pytest.mark.asyncio
async def test_pay_installment_same_org_still_works(client, org_b):
    """Org B paying its own plan must still succeed (legitimate call unaffected)."""
    async with httpx.AsyncClient(base_url=API_URL, timeout=10, headers=org_b["headers"]) as c:
        resp = await c.post(
            f"/api/v1/installments/{org_b['plan_id']}/pay",
            json={"schedule_id": org_b["schedule_id"], "amount": "100"},
        )
        assert resp.status_code == 200, resp.text
        detail = await c.get(f"/api/v1/installments/{org_b['plan_id']}")
        assert float(detail.json()["paid_amount"]) == 100.0


# ---------------------------------------------------------------------------
# get_courier_track — cross-tenant GPS history leak (explicit ticket example)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_courier_track_cross_org_blocked(client, org_b):
    resp = await client.get(f"/api/v1/courier/{org_b['employee_id']}/track")
    assert resp.status_code == 404, resp.text


@pytest.mark.asyncio
async def test_courier_track_same_org_still_works(org_b):
    """Also proves the pre-existing INTERVAL bind-param bug (always-500) is fixed."""
    async with httpx.AsyncClient(base_url=API_URL, timeout=10, headers=org_b["headers"]) as c:
        resp = await c.get(f"/api/v1/courier/{org_b['employee_id']}/track")
        assert resp.status_code == 200, resp.text
        assert resp.json() == []


# ---------------------------------------------------------------------------
# entity-tags — polymorphic table, no organization_id column of its own
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_entity_tags_cross_org_blocked(client, org_b):
    resp = await client.post(
        f"/api/v1/entity-tags/customer/{org_b['customer_id']}",
        json={"tag_ids": [org_b["tag_id"]]},
    )
    assert resp.status_code == 404, resp.text

    get_resp = await client.get(f"/api/v1/entity-tags/customer/{org_b['customer_id']}")
    assert get_resp.status_code == 404, get_resp.text


@pytest.mark.asyncio
async def test_entity_tags_same_org_still_works(org_b):
    async with httpx.AsyncClient(base_url=API_URL, timeout=10, headers=org_b["headers"]) as c:
        resp = await c.post(
            f"/api/v1/entity-tags/customer/{org_b['customer_id']}",
            json={"tag_ids": [org_b["tag_id"]]},
        )
        assert resp.status_code == 200, resp.text
        get_resp = await c.get(f"/api/v1/entity-tags/customer/{org_b['customer_id']}")
        assert get_resp.status_code == 200
        assert len(get_resp.json()) == 1


# ---------------------------------------------------------------------------
# custom-field-values — polymorphic table + field_id ownership
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_custom_field_values_cross_org_blocked(client, org_b):
    resp = await client.post(
        f"/api/v1/custom-field-values/customer/{org_b['customer_id']}",
        json={"values": {}},
    )
    assert resp.status_code == 404, resp.text


# ---------------------------------------------------------------------------
# attachments — table HAS organization_id directly, simplest case
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_attachments_cross_org_list_empty_not_leaked(client, org_b):
    resp = await client.get(f"/api/v1/attachments/customer/{org_b['customer_id']}")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_attachments_cross_org_delete_blocked(client, org_b):
    resp = await client.delete(f"/api/v1/attachments/{org_b['attachment_id']}")
    assert resp.status_code == 404, resp.text

    # Confirm the file still exists for Org B.
    async with httpx.AsyncClient(base_url=API_URL, timeout=10, headers=org_b["headers"]) as c:
        list_resp = await c.get(f"/api/v1/attachments/customer/{org_b['customer_id']}")
        assert len(list_resp.json()) == 1


# ---------------------------------------------------------------------------
# open-tickets items / close — child table with no org column of its own
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_open_ticket_item_cross_org_blocked(client, org_b):
    add_resp = await client.post(
        f"/api/v1/open-tickets/{org_b['ticket_id']}/items",
        json={"product_id": org_b["product_id"], "quantity": "1", "price": "1000"},
    )
    assert add_resp.status_code == 404, add_resp.text

    remove_resp = await client.delete(
        f"/api/v1/open-tickets/{org_b['ticket_id']}/items/{org_b['item_id']}"
    )
    assert remove_resp.status_code == 404, remove_resp.text

    close_resp = await client.post(f"/api/v1/open-tickets/{org_b['ticket_id']}/close")
    assert close_resp.status_code == 404, close_resp.text


# ---------------------------------------------------------------------------
# visits check-out / photos
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_visit_check_out_cross_org_blocked(client, org_b):
    resp = await client.post(f"/api/v1/visits/{org_b['visit_id']}/check-out", json={})
    assert resp.status_code == 404, resp.text


@pytest.mark.asyncio
async def test_visit_photo_cross_org_blocked(client, org_b):
    resp = await client.post(
        f"/api/v1/visits/{org_b['visit_id']}/photos",
        json={"photo_url": "https://example.com/p.jpg"},
    )
    assert resp.status_code == 404, resp.text


# ---------------------------------------------------------------------------
# cashbox-sessions/open — attacker-supplied cashbox_id from another org
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_open_session_cross_org_cashbox_blocked(client, org_b):
    resp = await client.post(
        "/api/v1/cashbox-sessions/open", json={"cashbox_id": org_b["cashbox_id"]}
    )
    assert resp.status_code == 404, resp.text


# ---------------------------------------------------------------------------
# pos-pages items
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_pos_page_items_cross_org_blocked(client, org_b):
    get_resp = await client.get(f"/api/v1/pos-pages/{org_b['page_id']}/items")
    assert get_resp.status_code == 404, get_resp.text

    set_resp = await client.post(
        f"/api/v1/pos-pages/{org_b['page_id']}/items",
        json={"product_ids": [org_b["product_id"]]},
    )
    assert set_resp.status_code == 404, set_resp.text


# ---------------------------------------------------------------------------
# delivery-orders status
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_delivery_status_cross_org_blocked(client, org_b):
    resp = await client.post(
        f"/api/v1/delivery-orders/{org_b['delivery_id']}/status",
        json={"status": "delivered"},
    )
    assert resp.status_code == 404, resp.text
