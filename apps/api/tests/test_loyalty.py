"""RG-6 — loyalty points ledger (real earn/redeem/adjust balance).

Covers:
- earn-on-pay: paying a sale in full credits sale_total * earn_pct / 100
  points once the org has configured settings[key='loyalty'].earn_pct.
- disabled-by-default: an org that never configured the 'loyalty' setting
  never earns anything (no silent activation).
- redeem-at-checkout: redeem_points on /pay applies as a discount and is
  rejected with 422 if it exceeds the customer's current balance.
- cancellation reversal: cancelling a sale that earned points claws them
  back via a signed 'adjust' ledger row (the ticket's #1 correctness risk).
- cross-org isolation: another org cannot see or adjust this customer's
  loyalty balance.

Run: docker exec erp-api pytest tests/test_loyalty.py -v
"""
import os
import random
import secrets

import httpx
import pytest

pytestmark = pytest.mark.asyncio

API_URL = os.environ.get("API_URL", "http://localhost:8000")
_SUFFIX = secrets.token_hex(4)


def _rand_phone() -> str:
    return "+998" + "".join(str(random.randint(0, 9)) for _ in range(9))


async def _register_org(org_name: str) -> dict:
    """Self-register a brand-new org + admin via the real phone+OTP flow
    (same pattern as test_hr_shifts_attendance.py / test_ecommerce_idempotency.py)."""
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
                "full_name": "RG6 QA Bot",
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

    return {"headers": {"Authorization": f"Bearer {token}", "X-Organization-Id": org_id},
            "org_id": org_id}


async def _set_earn_pct(client: httpx.AsyncClient, pct: str) -> None:
    resp = await client.put("/api/v1/settings/key/loyalty", json={"value": {"earn_pct": pct}})
    assert resp.status_code == 200, resp.text


async def _ensure_customer(client: httpx.AsyncClient, name: str) -> str:
    resp = await client.post("/api/v1/customer/customers", json={"name": name})
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _get_currency_id(client: httpx.AsyncClient) -> int:
    r = await client.get("/api/v1/reference/currencies")
    assert r.status_code == 200
    return r.json()[0]["id"]


async def _ensure_warehouse(client: httpx.AsyncClient, name: str) -> int:
    r = await client.get("/api/v1/warehouse/warehouses")
    assert r.status_code == 200
    for wh in r.json():
        if wh["name"] == name:
            return wh["id"]
    r = await client.post("/api/v1/warehouse/warehouses", json={"name": name})
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def _ensure_product(client: httpx.AsyncClient, name: str) -> str:
    r = await client.get("/api/v1/warehouse/products", params={"q": name, "limit": 5})
    assert r.status_code == 200
    for p in r.json():
        if p["name"] == name:
            return str(p["id"])
    r = await client.post("/api/v1/warehouse/products",
                          json={"name": name, "purchase_price": "500", "sale_price": "1000"})
    assert r.status_code in (200, 201), f"product create failed: {r.text}"
    return str(r.json()["id"])


async def _set_stock(client: httpx.AsyncClient, wh_id: int, product_id: str, qty: str) -> None:
    r = await client.post("/api/v1/warehouse/inventories", json={
        "warehouse_id": wh_id,
        "items": [{"product_id": product_id, "actual_qty": qty}],
    })
    assert r.status_code in (200, 201), f"inventory create: {r.text}"
    iid = r.json()["id"]
    r = await client.post(f"/api/v1/warehouse/inventories/{iid}/finish")
    assert r.status_code == 200, f"inventory finish: {r.text}"


async def _create_unpaid_sale(
    client: httpx.AsyncClient, customer_id: str, amount: float,
) -> str:
    wh_id = await _ensure_warehouse(client, f"RG6-Warehouse-{_SUFFIX}")
    pid = await _ensure_product(client, f"RG6-Product-{_SUFFIX}")
    cur_id = await _get_currency_id(client)
    await _set_stock(client, wh_id, pid, "100000")
    r = await client.post("/api/v1/sale/sales", json={
        "customer_id": customer_id,
        "warehouse_id": wh_id,
        "currency_id": cur_id,
        "items": [{"product_id": pid, "quantity": 1, "price": amount, "discount": 0}],
    })
    assert r.status_code == 201, r.text
    return r.json()["id"]


# ---------------------------------------------------------------------------
# earn-on-pay
# ---------------------------------------------------------------------------

async def test_earn_on_full_pay_credits_points(client: httpx.AsyncClient):
    await _set_earn_pct(client, "10")  # 10%
    cid = await _ensure_customer(client, f"RG6 Earn Customer {uuid_suffix()}")
    sale_id = await _create_unpaid_sale(client, cid, amount=100000)

    resp = await client.post(f"/api/v1/sale/sales/{sale_id}/pay", json={"amount": 100000})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "paid"
    assert float(body["loyalty_earned"]) == 10000.0

    loy = await client.get(f"/api/v1/customer/customers/{cid}/loyalty")
    assert loy.status_code == 200, loy.text
    data = loy.json()
    assert float(data["balance"]) == 10000.0
    assert len(data["history"]) == 1
    assert data["history"][0]["direction"] == "earn"
    assert float(data["history"][0]["points"]) == 10000.0
    assert data["history"][0]["sale_id"] == sale_id


async def test_earn_is_disabled_by_default_for_a_fresh_org():
    org = await _register_org(f"RG6 No-Loyalty Org {_SUFFIX}")
    async with httpx.AsyncClient(base_url=API_URL, timeout=10, headers=org["headers"]) as c:
        cid = await _ensure_customer(c, "RG6 Disabled Customer")
        sale_id = await _create_unpaid_sale(c, cid, amount=50000)

        resp = await c.post(f"/api/v1/sale/sales/{sale_id}/pay", json={"amount": 50000})
        assert resp.status_code == 200, resp.text
        assert float(resp.json()["loyalty_earned"]) == 0.0

        loy = await c.get(f"/api/v1/customer/customers/{cid}/loyalty")
        assert loy.status_code == 200
        assert float(loy.json()["balance"]) == 0.0
        assert loy.json()["history"] == []


# ---------------------------------------------------------------------------
# redeem-at-checkout
# ---------------------------------------------------------------------------

async def test_redeem_points_applies_discount_and_decreases_balance(client: httpx.AsyncClient):
    await _set_earn_pct(client, "10")
    cid = await _ensure_customer(client, f"RG6 Redeem Customer {uuid_suffix()}")

    # Earn 10000 points from a 100000 sale.
    earn_sale_id = await _create_unpaid_sale(client, cid, amount=100000)
    resp = await client.post(f"/api/v1/sale/sales/{earn_sale_id}/pay", json={"amount": 100000})
    assert resp.status_code == 200, resp.text
    assert float(resp.json()["loyalty_earned"]) == 10000.0

    # Spend 4000 of those points as a discount on a second sale. That second
    # sale (total 20000) is itself a fully-paid sale too, so it ALSO earns
    # its own 10% = 2000 points in the same request — earn is computed on
    # sales.total_amount, decoupled from any redeem discount applied in the
    # same payment. Net balance: 10000 (earn #1) - 4000 (redeem) + 2000
    # (earn #2) = 8000.
    spend_sale_id = await _create_unpaid_sale(client, cid, amount=20000)
    resp = await client.post(
        f"/api/v1/sale/sales/{spend_sale_id}/pay",
        json={"amount": 16000, "redeem_points": 4000},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "paid"
    assert float(body["paid_amount"]) == 20000.0
    assert float(body["loyalty_redeemed"]) == 4000.0
    assert float(body["loyalty_earned"]) == 2000.0

    loy = await client.get(f"/api/v1/customer/customers/{cid}/loyalty")
    assert float(loy.json()["balance"]) == 8000.0
    directions = {h["direction"] for h in loy.json()["history"]}
    assert "redeem" in directions and "earn" in directions


async def test_redeem_points_can_fully_cover_payment_with_zero_cash(client: httpx.AsyncClient):
    """amount's Field(gt=0) was relaxed to Field(ge=0) so a customer can pay
    entirely out of their points balance — guarded by an explicit 422 when
    BOTH amount and redeem_points are 0 (see next test)."""
    await _set_earn_pct(client, "10")
    cid = await _ensure_customer(client, f"RG6 FullPoints Customer {uuid_suffix()}")

    earn_sale_id = await _create_unpaid_sale(client, cid, amount=100000)
    resp = await client.post(f"/api/v1/sale/sales/{earn_sale_id}/pay", json={"amount": 100000})
    assert resp.status_code == 200, resp.text

    sale_id = await _create_unpaid_sale(client, cid, amount=9000)
    resp = await client.post(
        f"/api/v1/sale/sales/{sale_id}/pay",
        json={"amount": 0, "redeem_points": 9000},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "paid"
    assert float(body["paid_amount"]) == 9000.0
    assert float(body["loyalty_redeemed"]) == 9000.0


async def test_pay_with_zero_amount_and_zero_redeem_returns_422(client: httpx.AsyncClient):
    cid = await _ensure_customer(client, f"RG6 ZeroPay Customer {uuid_suffix()}")
    sale_id = await _create_unpaid_sale(client, cid, amount=5000)
    resp = await client.post(f"/api/v1/sale/sales/{sale_id}/pay", json={"amount": 0})
    assert resp.status_code == 422, resp.text


async def test_redeem_points_exceeding_balance_returns_422(client: httpx.AsyncClient):
    await _set_earn_pct(client, "10")
    cid = await _ensure_customer(client, f"RG6 OverRedeem Customer {uuid_suffix()}")

    # This customer has 0 points.
    sale_id = await _create_unpaid_sale(client, cid, amount=20000)
    resp = await client.post(
        f"/api/v1/sale/sales/{sale_id}/pay",
        json={"amount": 10000, "redeem_points": 50000},
    )
    assert resp.status_code == 422, resp.text

    # Nothing should have been written — sale stays unpaid, balance stays 0.
    sale = await client.get(f"/api/v1/sale/sales/{sale_id}")
    assert float(sale.json()["head"]["paid_amount"]) == 0.0

    loy = await client.get(f"/api/v1/customer/customers/{cid}/loyalty")
    assert float(loy.json()["balance"]) == 0.0


# ---------------------------------------------------------------------------
# cancellation reversal — the ticket's #1 correctness requirement
# ---------------------------------------------------------------------------

async def test_cancel_sale_reverses_earned_points(client: httpx.AsyncClient):
    await _set_earn_pct(client, "10")
    cid = await _ensure_customer(client, f"RG6 Cancel Customer {uuid_suffix()}")
    sale_id = await _create_unpaid_sale(client, cid, amount=50000)

    resp = await client.post(f"/api/v1/sale/sales/{sale_id}/pay", json={"amount": 50000})
    assert resp.status_code == 200, resp.text
    assert float(resp.json()["loyalty_earned"]) == 5000.0

    loy = await client.get(f"/api/v1/customer/customers/{cid}/loyalty")
    assert float(loy.json()["balance"]) == 5000.0

    cancel = await client.post(f"/api/v1/sale/sales/{sale_id}/cancel")
    assert cancel.status_code == 200, cancel.text
    assert float(cancel.json()["loyalty_points_reversed"]) == 5000.0

    loy_after = await client.get(f"/api/v1/customer/customers/{cid}/loyalty")
    assert float(loy_after.json()["balance"]) == 0.0
    history = loy_after.json()["history"]
    assert any(h["direction"] == "adjust" and float(h["points"]) == -5000.0 for h in history)


async def test_cancel_sale_without_earned_points_is_a_noop(client: httpx.AsyncClient):
    """A sale that never got fully paid (so it never earned anything) must
    not write a spurious reversal row on cancel."""
    await _set_earn_pct(client, "10")
    cid = await _ensure_customer(client, f"RG6 NoEarn Cancel Customer {uuid_suffix()}")
    sale_id = await _create_unpaid_sale(client, cid, amount=50000)
    # Never paid — cancel immediately.
    cancel = await client.post(f"/api/v1/sale/sales/{sale_id}/cancel")
    assert cancel.status_code == 200, cancel.text
    assert float(cancel.json()["loyalty_points_reversed"]) == 0.0

    loy = await client.get(f"/api/v1/customer/customers/{cid}/loyalty")
    assert float(loy.json()["balance"]) == 0.0
    assert loy.json()["history"] == []


# ---------------------------------------------------------------------------
# manual admin adjustment
# ---------------------------------------------------------------------------

async def test_manual_adjust_changes_balance(client: httpx.AsyncClient):
    cid = await _ensure_customer(client, f"RG6 Adjust Customer {uuid_suffix()}")

    resp = await client.post(
        f"/api/v1/customer/customers/{cid}/loyalty/adjust",
        json={"points": "500", "notes": "Marketing bonus"},
    )
    assert resp.status_code == 201, resp.text
    assert float(resp.json()["new_balance"]) == 500.0

    loy = await client.get(f"/api/v1/customer/customers/{cid}/loyalty")
    assert float(loy.json()["balance"]) == 500.0
    assert loy.json()["history"][0]["sale_id"] is None

    bad = await client.post(
        f"/api/v1/customer/customers/{cid}/loyalty/adjust",
        json={"points": "0"},
    )
    assert bad.status_code == 422, bad.text


async def test_manual_adjust_is_idempotency_key_protected(client: httpx.AsyncClient):
    """Repeating the exact same request with the same Idempotency-Key must
    return the cached response and apply the balance change only once."""
    cid = await _ensure_customer(client, f"RG6 Idempotent Customer {uuid_suffix()}")
    ikey = f"rg6-adjust-{uuid_suffix()}"
    payload = {"points": "250", "notes": "One-time bonus"}

    first = await client.post(
        f"/api/v1/customer/customers/{cid}/loyalty/adjust",
        json=payload, headers={"Idempotency-Key": ikey},
    )
    assert first.status_code == 201, first.text
    assert float(first.json()["new_balance"]) == 250.0

    second = await client.post(
        f"/api/v1/customer/customers/{cid}/loyalty/adjust",
        json=payload, headers={"Idempotency-Key": ikey},
    )
    assert second.status_code == 201, second.text
    assert second.json() == first.json()

    loy = await client.get(f"/api/v1/customer/customers/{cid}/loyalty")
    assert float(loy.json()["balance"]) == 250.0, "balance must not double-apply on replay"
    assert len(loy.json()["history"]) == 1


# ---------------------------------------------------------------------------
# cross-org isolation
# ---------------------------------------------------------------------------

async def test_cross_org_cannot_see_or_adjust_other_orgs_customer(client: httpx.AsyncClient):
    cid = await _ensure_customer(client, f"RG6 IsolatedCustomer {uuid_suffix()}")
    await client.post(
        f"/api/v1/customer/customers/{cid}/loyalty/adjust",
        json={"points": "100"},
    )

    org_b = await _register_org(f"RG6 Org B {_SUFFIX}")
    async with httpx.AsyncClient(base_url=API_URL, timeout=10, headers=org_b["headers"]) as c2:
        get_resp = await c2.get(f"/api/v1/customer/customers/{cid}/loyalty")
        assert get_resp.status_code == 404, get_resp.text

        adjust_resp = await c2.post(
            f"/api/v1/customer/customers/{cid}/loyalty/adjust",
            json={"points": "999999"},
        )
        assert adjust_resp.status_code == 404, adjust_resp.text

    # Org A's own view must be unaffected by org B's attempt.
    loy = await client.get(f"/api/v1/customer/customers/{cid}/loyalty")
    assert float(loy.json()["balance"]) == 100.0


def uuid_suffix() -> str:
    return secrets.token_hex(4)
