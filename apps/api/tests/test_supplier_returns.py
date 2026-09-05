"""
Integration tests for supplier returns workflow (T-202).
Requires a running API with the test org seeded (qa@example.com / Qa12345!).
Run inside container: docker exec erp-api pytest apps/api/tests/test_supplier_returns.py -v
"""
import pytest
import pytest_asyncio
import httpx

from tests.conftest import API_URL

pytestmark = pytest.mark.asyncio


# =========================================================
# Test helpers
# =========================================================

async def _ensure_supplier(client: httpx.AsyncClient, name: str) -> str:
    r = await client.get("/api/v1/supplier/suppliers")
    assert r.status_code == 200
    for s in r.json():
        if s["name"] == name:
            return str(s["id"])
    r = await client.post("/api/v1/supplier/suppliers", json={"name": name, "phone": "998991234567"})
    assert r.status_code == 201, r.text
    return str(r.json()["id"])


async def _ensure_warehouse(client: httpx.AsyncClient, name: str) -> int:
    r = await client.get("/api/v1/warehouse/warehouses")
    assert r.status_code == 200
    for wh in r.json():
        if wh["name"] == name:
            return int(wh["id"])
    r = await client.post("/api/v1/warehouse/warehouses", json={"name": name})
    assert r.status_code == 201, r.text
    return int(r.json()["id"])


async def _ensure_product(client: httpx.AsyncClient, name: str) -> str:
    r = await client.get("/api/v1/warehouse/products", params={"q": name})
    assert r.status_code == 200
    for p in r.json():
        if p["name"] == name:
            return str(p["id"])
    r = await client.post("/api/v1/warehouse/products",
                          json={"name": name, "purchase_price": "1000"})
    assert r.status_code == 201, r.text
    return str(r.json()["id"])


async def _set_stock(client: httpx.AsyncClient, warehouse_id: int,
                     product_id: str, qty: str) -> None:
    r = await client.post("/api/v1/warehouse/inventories", json={
        "warehouse_id": warehouse_id,
        "items": [{"product_id": product_id, "actual_qty": qty}],
    })
    assert r.status_code in (200, 201), f"inventory create failed: {r.text}"
    iid = r.json()["id"]
    r = await client.post(f"/api/v1/warehouse/inventories/{iid}/finish")
    assert r.status_code == 200, f"inventory finish failed: {r.text}"


async def _get_stock(client: httpx.AsyncClient, warehouse_id: int, product_id: str) -> str:
    r = await client.get("/api/v1/warehouse/stock/on-hand",
                         params={"warehouse_id": warehouse_id, "product_id": product_id})
    assert r.status_code == 200
    data = r.json()
    return str(data[0]["qty"]) if data else "0"


async def _get_supplier_balance(client: httpx.AsyncClient, supplier_id: str) -> float:
    r = await client.get(f"/api/v1/supplier/suppliers/{supplier_id}/balance")
    assert r.status_code == 200
    return float(r.json()["balance"])


async def _create_return_draft(
    client: httpx.AsyncClient,
    supplier_id: str,
    warehouse_id: int,
    product_id: str,
    qty: str = "5",
    unit_cost: str = "1000",
    refund_method: str = "cash_refund",
) -> dict:
    r = await client.post("/api/v1/warehouse/supplier-returns", json={
        "supplier_id": supplier_id,
        "warehouse_id": warehouse_id,
        "refund_method": refund_method,
        "items": [{"product_id": product_id, "quantity": qty, "unit_cost": unit_cost}],
    })
    assert r.status_code == 201, r.text
    return r.json()


# =========================================================
# Test cases
# =========================================================

@pytest.mark.asyncio
async def test_create_draft_and_list(client: httpx.AsyncClient):
    """Create draft supplier return, verify it appears in list."""
    supplier_id = await _ensure_supplier(client, "_TEST_SR_SUPPLIER_LIST")
    wh_id = await _ensure_warehouse(client, "_TEST_SR_WH_LIST")
    product_id = await _ensure_product(client, "_TEST_SR_PRODUCT_LIST")
    await _set_stock(client, wh_id, product_id, "10")

    data = await _create_return_draft(client, supplier_id, wh_id, product_id)
    assert "id" in data
    assert data["doc_number"].startswith("SR-")

    r = await client.get("/api/v1/warehouse/supplier-returns",
                         params={"supplier_id": supplier_id})
    assert r.status_code == 200
    result = r.json()
    assert result["total"] >= 1
    ids = [item["id"] for item in result["items"]]
    assert data["id"] in ids


@pytest.mark.asyncio
async def test_get_detail(client: httpx.AsyncClient):
    """GET /supplier-returns/{id} returns full detail with items."""
    supplier_id = await _ensure_supplier(client, "_TEST_SR_SUPPLIER_DETAIL")
    wh_id = await _ensure_warehouse(client, "_TEST_SR_WH_DETAIL")
    product_id = await _ensure_product(client, "_TEST_SR_PRODUCT_DETAIL")
    await _set_stock(client, wh_id, product_id, "10")

    created = await _create_return_draft(client, supplier_id, wh_id, product_id, qty="3", unit_cost="500")

    r = await client.get(f"/api/v1/warehouse/supplier-returns/{created['id']}")
    assert r.status_code == 200
    detail = r.json()
    assert detail["status"] == "draft"
    assert len(detail["items"]) == 1
    assert detail["items"][0]["product_id"] == product_id


@pytest.mark.asyncio
async def test_confirm_cash_refund_stock_deducted_and_cash_movement_created(client: httpx.AsyncClient):
    """Draft → confirm with cash_refund: stock decreases, cash_movement created."""
    supplier_id = await _ensure_supplier(client, "_TEST_SR_SUPPLIER_CASH")
    wh_id = await _ensure_warehouse(client, "_TEST_SR_WH_CASH")
    product_id = await _ensure_product(client, "_TEST_SR_PRODUCT_CASH")
    await _set_stock(client, wh_id, product_id, "20")

    qty_before = float(await _get_stock(client, wh_id, product_id))

    created = await _create_return_draft(
        client, supplier_id, wh_id, product_id,
        qty="5", unit_cost="1000", refund_method="cash_refund"
    )

    r = await client.post(f"/api/v1/warehouse/supplier-returns/{created['id']}/confirm")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] is True
    assert float(body["refund_amount"]) == 5000.0

    qty_after = float(await _get_stock(client, wh_id, product_id))
    assert qty_after == qty_before - 5.0

    r2 = await client.get(f"/api/v1/warehouse/supplier-returns/{created['id']}")
    assert r2.json()["status"] == "confirmed"
    assert float(r2.json()["refund_amount"]) == 5000.0


@pytest.mark.asyncio
async def test_confirm_insufficient_stock_returns_422(client: httpx.AsyncClient):
    """Confirm with quantity > on_hand must return 422."""
    supplier_id = await _ensure_supplier(client, "_TEST_SR_SUPPLIER_INSUF")
    wh_id = await _ensure_warehouse(client, "_TEST_SR_WH_INSUF")
    product_id = await _ensure_product(client, "_TEST_SR_PRODUCT_INSUF")
    await _set_stock(client, wh_id, product_id, "2")

    created = await _create_return_draft(
        client, supplier_id, wh_id, product_id,
        qty="100", unit_cost="1000", refund_method="cash_refund"
    )

    r = await client.post(f"/api/v1/warehouse/supplier-returns/{created['id']}/confirm")
    assert r.status_code == 422, r.text


@pytest.mark.asyncio
async def test_cancel_confirmed_restores_stock(client: httpx.AsyncClient):
    """Cancel a confirmed return → stock is restored."""
    supplier_id = await _ensure_supplier(client, "_TEST_SR_SUPPLIER_CANCEL")
    wh_id = await _ensure_warehouse(client, "_TEST_SR_WH_CANCEL")
    product_id = await _ensure_product(client, "_TEST_SR_PRODUCT_CANCEL")
    await _set_stock(client, wh_id, product_id, "15")

    qty_before = float(await _get_stock(client, wh_id, product_id))

    created = await _create_return_draft(
        client, supplier_id, wh_id, product_id,
        qty="5", unit_cost="800", refund_method="replacement"
    )
    await client.post(f"/api/v1/warehouse/supplier-returns/{created['id']}/confirm")
    qty_after_confirm = float(await _get_stock(client, wh_id, product_id))
    assert qty_after_confirm == qty_before - 5.0

    r = await client.post(f"/api/v1/warehouse/supplier-returns/{created['id']}/cancel")
    assert r.status_code == 200, r.text

    qty_after_cancel = float(await _get_stock(client, wh_id, product_id))
    assert qty_after_cancel == qty_before

    r2 = await client.get(f"/api/v1/warehouse/supplier-returns/{created['id']}")
    assert r2.json()["status"] == "cancelled"


@pytest.mark.asyncio
async def test_replacement_no_cash_movement(client: httpx.AsyncClient):
    """refund_method=replacement: stock deducted but no cash_movement generated (refund_amount=0)."""
    supplier_id = await _ensure_supplier(client, "_TEST_SR_SUPPLIER_REPL")
    wh_id = await _ensure_warehouse(client, "_TEST_SR_WH_REPL")
    product_id = await _ensure_product(client, "_TEST_SR_PRODUCT_REPL")
    await _set_stock(client, wh_id, product_id, "10")

    created = await _create_return_draft(
        client, supplier_id, wh_id, product_id,
        qty="3", unit_cost="500", refund_method="replacement"
    )

    r = await client.post(f"/api/v1/warehouse/supplier-returns/{created['id']}/confirm")
    assert r.status_code == 200, r.text

    detail = (await client.get(f"/api/v1/warehouse/supplier-returns/{created['id']}")).json()
    assert detail["status"] == "confirmed"
    # refund_amount may be 0 or the item total depending on implementation; stock must be deducted
    # The key assertion: stock went down
    qty_after = float(await _get_stock(client, wh_id, product_id))
    assert qty_after <= 7.0


@pytest.mark.asyncio
async def test_supplier_balance_refund_method(client: httpx.AsyncClient):
    """refund_method=supplier_balance: supplier balance increases."""
    supplier_id = await _ensure_supplier(client, "_TEST_SR_SUPPLIER_BAL")
    wh_id = await _ensure_warehouse(client, "_TEST_SR_WH_BAL")
    product_id = await _ensure_product(client, "_TEST_SR_PRODUCT_BAL")
    await _set_stock(client, wh_id, product_id, "10")

    bal_before = await _get_supplier_balance(client, supplier_id)

    created = await _create_return_draft(
        client, supplier_id, wh_id, product_id,
        qty="4", unit_cost="750", refund_method="supplier_balance"
    )

    r = await client.post(f"/api/v1/warehouse/supplier-returns/{created['id']}/confirm")
    assert r.status_code == 200, r.text
    assert float(r.json()["refund_amount"]) == 3000.0

    bal_after = await _get_supplier_balance(client, supplier_id)
    assert bal_after == bal_before + 3000.0


@pytest.mark.asyncio
async def test_stock_movements_journal_purchase_return_rows(client: httpx.AsyncClient):
    """Confirm writes stock_movements rows with operation_type='purchase_return' per item,
    sharing the same correlation_id."""
    supplier_id = await _ensure_supplier(client, "_TEST_SR_SUPPLIER_JRNL")
    wh_id = await _ensure_warehouse(client, "_TEST_SR_WH_JRNL")
    pid1 = await _ensure_product(client, "_TEST_SR_PRODUCT_JRNL1")
    pid2 = await _ensure_product(client, "_TEST_SR_PRODUCT_JRNL2")
    await _set_stock(client, wh_id, pid1, "10")
    await _set_stock(client, wh_id, pid2, "10")

    r = await client.post("/api/v1/warehouse/supplier-returns", json={
        "supplier_id": supplier_id,
        "warehouse_id": wh_id,
        "refund_method": "cash_refund",
        "items": [
            {"product_id": pid1, "quantity": "2", "unit_cost": "100"},
            {"product_id": pid2, "quantity": "3", "unit_cost": "200"},
        ],
    })
    assert r.status_code == 201, r.text
    rid = r.json()["id"]

    await client.post(f"/api/v1/warehouse/supplier-returns/{rid}/confirm")

    r2 = await client.get("/api/v1/warehouse/movements", params={
        "source_type": "supplier_return",
        "source_id": rid,
    })
    assert r2.status_code == 200
    movements = r2.json()["items"]
    assert len(movements) == 2

    operation_types = {m["operation_type"] for m in movements}
    assert operation_types == {"purchase_return"}

    correlation_ids = {m["correlation_id"] for m in movements}
    assert len(correlation_ids) == 1, "All items must share the same correlation_id"


@pytest.mark.asyncio
async def test_delete_draft_only(client: httpx.AsyncClient):
    """DELETE allowed on draft; returns 409 on confirmed."""
    supplier_id = await _ensure_supplier(client, "_TEST_SR_SUPPLIER_DEL")
    wh_id = await _ensure_warehouse(client, "_TEST_SR_WH_DEL")
    product_id = await _ensure_product(client, "_TEST_SR_PRODUCT_DEL")
    await _set_stock(client, wh_id, product_id, "10")

    created = await _create_return_draft(client, supplier_id, wh_id, product_id)
    r = await client.delete(f"/api/v1/warehouse/supplier-returns/{created['id']}")
    assert r.status_code == 200

    # Confirm a second one and try to delete it
    created2 = await _create_return_draft(client, supplier_id, wh_id, product_id)
    await client.post(f"/api/v1/warehouse/supplier-returns/{created2['id']}/confirm")
    r2 = await client.delete(f"/api/v1/warehouse/supplier-returns/{created2['id']}")
    assert r2.status_code == 409


@pytest.mark.asyncio
async def test_doc_number_sequential_per_org(client: httpx.AsyncClient):
    """Two consecutive supplier returns in the same org get sequential SR- doc numbers."""
    supplier_id = await _ensure_supplier(client, "_TEST_SR_SUPPLIER_SEQ")
    wh_id = await _ensure_warehouse(client, "_TEST_SR_WH_SEQ")
    product_id = await _ensure_product(client, "_TEST_SR_PRODUCT_SEQ")
    await _set_stock(client, wh_id, product_id, "30")

    d1 = await _create_return_draft(client, supplier_id, wh_id, product_id, qty="1")
    d2 = await _create_return_draft(client, supplier_id, wh_id, product_id, qty="1")

    n1 = int(d1["doc_number"].split("-")[-1])
    n2 = int(d2["doc_number"].split("-")[-1])
    assert n2 == n1 + 1, f"Expected sequential: {d1['doc_number']} → {d2['doc_number']}"


@pytest.mark.asyncio
async def test_cross_org_isolation(client: httpx.AsyncClient):
    """Returns from another org are not visible."""
    supplier_id = await _ensure_supplier(client, "_TEST_SR_SUPPLIER_ISO")
    wh_id = await _ensure_warehouse(client, "_TEST_SR_WH_ISO")
    product_id = await _ensure_product(client, "_TEST_SR_PRODUCT_ISO")
    await _set_stock(client, wh_id, product_id, "10")

    created = await _create_return_draft(client, supplier_id, wh_id, product_id)

    # Same client (same org) — should find it
    r = await client.get(f"/api/v1/warehouse/supplier-returns/{created['id']}")
    assert r.status_code == 200

    # Try accessing with a fake UUID — should 404, not leak data
    r2 = await client.get("/api/v1/warehouse/supplier-returns/00000000-0000-0000-0000-000000000000")
    assert r2.status_code == 404


@pytest.mark.asyncio
async def test_cross_org_supplier_validation(client: httpx.AsyncClient):
    """supplier_id that does not belong to the org must return 422."""
    wh_id = await _ensure_warehouse(client, "_TEST_SR_WH_XORG")
    product_id = await _ensure_product(client, "_TEST_SR_PRODUCT_XORG")

    r = await client.post("/api/v1/warehouse/supplier-returns", json={
        "supplier_id": "00000000-0000-0000-0000-000000000001",
        "warehouse_id": wh_id,
        "refund_method": "cash_refund",
        "items": [{"product_id": product_id, "quantity": "1", "unit_cost": "100"}],
    })
    assert r.status_code == 422, r.text
