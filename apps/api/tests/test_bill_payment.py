"""Tests for T-114: Bill payment (Click extension).

Run inside the API container:
  docker exec erp-api pytest apps/api/tests/test_bill_payment.py -v
"""
import pytest
import httpx

from tests.conftest import API_URL


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

BILL_PAYMENT_URL = "/api/v1/finance/bill-payment"


# ---------------------------------------------------------------------------
# Happy path: services list from click module
# ---------------------------------------------------------------------------

def test_bill_services_catalog():
    """BILL_SERVICES catalog has exactly 5 entries with required fields."""
    from app.modules.integration.payments.click import BILL_SERVICES, _BILL_SERVICE_IDS

    assert len(BILL_SERVICES) == 5
    expected_ids = {"elektr", "gaz", "suv", "internet", "telefon"}
    assert _BILL_SERVICE_IDS == expected_ids

    for svc in BILL_SERVICES:
        assert "id" in svc
        assert "name" in svc
        assert svc["provider"] == "click"


# ---------------------------------------------------------------------------
# Happy path: create_bill_payment_link returns correct shape
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_bill_payment_link_stub():
    """create_bill_payment_link returns payment_url, invoice_id, expires_at."""
    from decimal import Decimal
    from app.modules.integration.payments.click import create_bill_payment_link

    result = await create_bill_payment_link(
        org_id="test-org",
        service_id="elektr",
        account="12345678",
        amount=Decimal("150000"),
        return_url="https://example.com/return",
    )

    assert "payment_url" in result
    assert "invoice_id" in result
    assert "expires_at" in result
    assert result["stubbed"] is True
    assert "my.click.uz" in result["payment_url"]
    assert result["invoice_id"].startswith("stub-")


# ---------------------------------------------------------------------------
# Error case: unknown service_id raises ValueError
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_bill_payment_link_unknown_service():
    """create_bill_payment_link raises ValueError for unknown service_id."""
    from decimal import Decimal
    from app.modules.integration.payments.click import create_bill_payment_link

    with pytest.raises(ValueError, match="Unknown bill service_id"):
        await create_bill_payment_link(
            org_id="test-org",
            service_id="unknown_service",
            account="12345678",
            amount=Decimal("50000"),
            return_url="",
        )


# ---------------------------------------------------------------------------
# Integration: POST /finance/bill-payment — Click disabled returns 400
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_bill_payment_click_disabled_returns_400(client: httpx.AsyncClient):
    """When Click is not enabled for the org, endpoint returns 400."""
    payload = {
        "bill_type": "electricity",
        "account_number": "98765432",
        "amount": 100000,
    }
    resp = await client.post(BILL_PAYMENT_URL, json=payload)
    # Click is not configured in the test org by default → 400
    assert resp.status_code == 400, resp.text
    data = resp.json()
    assert "detail" in data
    assert "click" in data["detail"].lower() or "sozlamalardan" in data["detail"].lower()


# ---------------------------------------------------------------------------
# Integration: POST /finance/bill-payment — unauthenticated returns 401/403
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_bill_payment_unauthenticated(http_client: httpx.AsyncClient):
    """Unauthenticated request is rejected."""
    payload = {
        "bill_type": "gas",
        "account_number": "11223344",
        "amount": 50000,
    }
    resp = await http_client.post(BILL_PAYMENT_URL, json=payload)
    assert resp.status_code in (400, 401, 403)


# ---------------------------------------------------------------------------
# Integration: POST /finance/bill-payment — invalid bill_type returns 422
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_bill_payment_invalid_bill_type(client: httpx.AsyncClient):
    """Invalid bill_type value returns 422 validation error."""
    payload = {
        "bill_type": "steam",
        "account_number": "11223344",
        "amount": 50000,
    }
    resp = await client.post(BILL_PAYMENT_URL, json=payload)
    assert resp.status_code == 422, resp.text


# ---------------------------------------------------------------------------
# Integration: POST /finance/bill-payment — idempotency deduplication
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_bill_payment_idempotency_deduplication(client: httpx.AsyncClient):
    """Two requests with same Idempotency-Key return the same transaction_id.

    This test only runs when Click is enabled. If Click is disabled (400),
    idempotency is not yet reachable — the test is skipped gracefully.
    """
    import uuid

    ikey = str(uuid.uuid4())
    headers = {"Idempotency-Key": ikey}
    payload = {
        "bill_type": "water",
        "account_number": "55667788",
        "amount": 75000,
    }

    resp1 = await client.post(BILL_PAYMENT_URL, json=payload, headers=headers)
    if resp1.status_code == 400:
        # Click not enabled in this test environment — idempotency not testable
        pytest.skip("Click not enabled; idempotency test skipped")

    assert resp1.status_code == 200, resp1.text
    tx1 = resp1.json()["transaction_id"]

    resp2 = await client.post(BILL_PAYMENT_URL, json=payload, headers=headers)
    assert resp2.status_code == 200, resp2.text
    tx2 = resp2.json()["transaction_id"]

    assert tx1 == tx2, "Idempotent repeat must return the same transaction_id"


# ---------------------------------------------------------------------------
# Unit: permission catalog contains finance.bill_payment
# ---------------------------------------------------------------------------

def test_finance_bill_payment_in_permissions():
    """finance.bill_payment exists in ALL_PERMISSIONS."""
    from app.modules.rbac.permissions import ALL_PERMISSIONS

    codes = {p["code"] for p in ALL_PERMISSIONS}
    assert "finance.bill_payment" in codes


def test_finance_bill_payment_cashier_grant():
    """finance.bill_payment is granted to cashier role."""
    from app.modules.rbac.permissions import ROLE_GRANTS

    assert "finance.bill_payment" in ROLE_GRANTS["cashier"]


def test_finance_bill_payment_accountant_grant():
    """finance.bill_payment is granted to accountant role."""
    from app.modules.rbac.permissions import ROLE_GRANTS

    assert "finance.bill_payment" in ROLE_GRANTS["accountant"]
