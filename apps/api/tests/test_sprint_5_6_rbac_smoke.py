"""RBAC smoke tests for Sprint 5-6 endpoints.

Covers:
- 401 for missing credentials
- 403/404 for cross-organization access
- 200 for authorized admin
- Sensitive endpoints (finance.set_balance, supplier.return.confirm)
  refuse execution when Bearer token / X-Organization-Id are absent
"""
import os
import uuid

import pytest
import httpx


API = os.environ.get("API_URL", "http://localhost:8000")


# ---- 1. Unauthenticated -> 401 -----------------------------------------------


@pytest.mark.parametrize(
    "method,path",
    [
        ("GET",   "/api/v1/rbac/me/permissions"),
        ("GET",   "/api/v1/warehouse/products"),
        ("GET",   "/api/v1/warehouse/supplier-returns"),
        ("GET",   "/api/v1/warehouse/stock-ins"),
        ("GET",   "/api/v1/warehouse/movements"),
        ("GET",   "/api/v1/statistics/cogs"),
        ("POST",  "/api/v1/warehouse/supplier-returns"),
        ("POST",  "/api/v1/warehouse/stock-ins"),
        ("POST",  "/api/v1/finance/cashbox-set-balance"),
        ("POST",  "/api/v1/finance/customer-set-balance"),
    ],
)
async def test_no_auth_returns_401(method, path):
    """Bearer/org headerlarsiz har state-changing va sensitive read endpoint 401."""
    async with httpx.AsyncClient(base_url=API, timeout=5) as c:
        resp = await c.request(method, path, json={} if method == "POST" else None)
    assert resp.status_code == 401, (
        f"{method} {path} without auth returned {resp.status_code} "
        f"(expected 401). Body: {resp.text[:200]}"
    )


# ---- 2. Wrong / missing X-Organization-Id -----------------------------------


async def test_missing_org_header_returns_400(http_client, auth_token):
    """Bearer bor lekin X-Organization-Id yo'q -> 400."""
    headers = {"Authorization": f"Bearer {auth_token}"}
    resp = await http_client.get(
        "/api/v1/warehouse/products", headers=headers
    )
    assert resp.status_code == 400, (
        f"Missing X-Organization-Id -> {resp.status_code} (expected 400)"
    )


async def test_wrong_org_id_isolates_resources(http_client, auth_token):
    """Random UUID X-Organization-Id -> ma'lumot yo'q (empty list yoki 403/404)."""
    fake_org = str(uuid.uuid4())
    headers = {
        "Authorization": f"Bearer {auth_token}",
        "X-Organization-Id": fake_org,
    }
    resp = await http_client.get(
        "/api/v1/warehouse/products?warehouse_id=1&page=1&limit=5",
        headers=headers,
    )
    # 401/403/404 — endpoint zero-info leak qilmasin
    # 200 bilan empty list ham OK (foydalanuvchi bu org'ga tegishli emas, but
    # backend perms check middleware'da bo'lishi kerak)
    assert resp.status_code in (401, 403, 404, 200), (
        f"Cross-org access unexpected status {resp.status_code}"
    )
    if resp.status_code == 200:
        body = resp.json()
        # Paginated shape yoki flat list — ikkalasi ham 0 element bo'lishi kerak
        items = body.get("items") if isinstance(body, dict) else body
        assert items == [] or items is None, (
            "Cross-org query returned data — tenant isolation broken"
        )


# ---- 3. Authorized admin -> 200 (existing client fixture = admin) ----------


async def test_admin_can_read_movements(client):
    """Admin (qa@example.com) stock_movements journal'ni ko'ra oladi."""
    resp = await client.get(
        "/api/v1/warehouse/movements?limit=5"
    )
    assert resp.status_code == 200, resp.text


async def test_admin_can_list_supplier_returns(client):
    resp = await client.get("/api/v1/warehouse/supplier-returns?limit=5")
    assert resp.status_code == 200, resp.text


async def test_admin_can_list_stock_ins(client):
    resp = await client.get("/api/v1/warehouse/stock-ins?limit=5")
    assert resp.status_code == 200, resp.text


# ---- 4. Cross-org POST rejected --------------------------------------------


async def test_set_balance_requires_auth_and_org(http_client, auth_token):
    """POST /finance/cashbox-set-balance auth siz 401, org siz 400."""
    # No auth
    r1 = await http_client.post(
        "/api/v1/finance/cashbox-set-balance",
        json={"cashbox_id": 1, "new_balance": 0, "note": "test"},
    )
    assert r1.status_code == 401
    # Auth but no org
    r2 = await http_client.post(
        "/api/v1/finance/cashbox-set-balance",
        json={"cashbox_id": 1, "new_balance": 0, "note": "test"},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert r2.status_code == 400


# ---- 5. Product barcode + supplier return org isolation -------------------


async def test_barcode_lookup_scoped_to_org(client):
    """GET /warehouse/barcode-lookup?barcode=X — org-scoped, unknown -> 404."""
    unique_barcode = "NEVEREXISTS" + uuid.uuid4().hex[:8].upper()
    resp = await client.get(
        f"/api/v1/warehouse/barcode-lookup?barcode={unique_barcode}"
    )
    # 404 (not found in this org) yoki 422 (payload validation) — ikkalasi ham
    # zero-info leak, tenant boundary buzilmaydi
    assert resp.status_code in (404, 422)


# ---- 6. Hidden warehouse routes still enforce backend RBAC ----------------
# menu.config.ts'da yashirilgan sahifalar (recommended-stock, cost-of-goods, ...)
# frontend ko'rinmasin, backend hali auth talab qilsin.


async def test_hidden_warehouse_endpoint_still_gated(http_client):
    """Warehouse endpoint hidden-menu bo'lsa ham backend auth kerak."""
    resp = await http_client.get(
        "/api/v1/warehouse/recommended-stock",
    )
    # 401 (no auth) yoki 404 (endpoint yo'q) — hech qanday 200 without auth
    assert resp.status_code in (401, 404), (
        f"Hidden endpoint /warehouse/recommended-stock returned "
        f"{resp.status_code} without auth — security gap"
    )
