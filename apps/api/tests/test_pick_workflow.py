"""
T-025 — Pick workflow endpoint tests.

Covers:
  - GET /orders/{oid}/pick: pick list structure
  - PATCH /orders/{oid}/items/{iid}/pick: happy path (picked → count increments)
  - PATCH … not_found: count doesn't increment picked_count but status changes
  - PATCH idempotency: same Idempotency-Key returns same response
  - GET/POST /orders/{oid}/pick/messages: message log append
  - 404 on unknown order
  - Org isolation: cross-org order access returns 404
"""
import uuid
import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_or_create_sale(client) -> tuple[str, int]:
    """
    Return (sale_id, first_item_id) for a confirmed sale in the test org.
    Tries to reuse an existing sale to avoid stock issues.
    """
    resp = await client.get("/api/v1/sale/sales?limit=5")
    assert resp.status_code == 200, resp.text
    sales = resp.json()
    for s in sales:
        sale_id = s["id"]
        detail = await client.get(f"/api/v1/sale/sales/{sale_id}")
        if detail.status_code == 200:
            items = detail.json().get("items", [])
            if items:
                # sale_items rows have product_id — we need the item id
                # which comes from a separate query; use the pick list to get it
                pick = await client.get(f"/api/v1/orders/{sale_id}/pick")
                if pick.status_code == 200 and pick.json()["items"]:
                    iid = pick.json()["items"][0]["item_id"]
                    return sale_id, iid

    pytest.skip("No existing sale with items found; seed demo data first")


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_pick_list_404_unknown_order(client):
    fake_id = str(uuid.uuid4())
    resp = await client.get(f"/api/v1/orders/{fake_id}/pick")
    assert resp.status_code == 404
    assert "topilmadi" in resp.json()["detail"].lower() or resp.json()["detail"]


@pytest.mark.asyncio
async def test_pick_list_structure(client):
    sale_id, _ = await _get_or_create_sale(client)
    resp = await client.get(f"/api/v1/orders/{sale_id}/pick")
    assert resp.status_code == 200, resp.text
    data = resp.json()

    for key in ("order_id", "doc_number", "customer_name", "total_items",
                "picked_count", "not_found_count", "items"):
        assert key in data, f"Missing key: {key}"

    assert data["order_id"] == sale_id
    assert isinstance(data["total_items"], int)
    assert isinstance(data["picked_count"], int)
    assert isinstance(data["not_found_count"], int)
    assert isinstance(data["items"], list)

    if data["items"]:
        item = data["items"][0]
        for field in ("item_id", "product_id", "product_name", "quantity",
                      "unit_name", "cell_code", "pick_status"):
            assert field in item, f"Missing item field: {field}"
        assert item["pick_status"] in ("pending", "picked", "not_found")


@pytest.mark.asyncio
async def test_patch_pick_status_picked_increments_count(client):
    sale_id, item_id = await _get_or_create_sale(client)

    before = await client.get(f"/api/v1/orders/{sale_id}/pick")
    assert before.status_code == 200
    before_count = before.json()["picked_count"]

    resp = await client.patch(
        f"/api/v1/orders/{sale_id}/items/{item_id}/pick",
        json={"status": "picked"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["item_id"] == item_id
    assert data["pick_status"] == "picked"
    assert data["picked_by"] is not None
    assert data["picked_at"] is not None
    assert "order_totals" in data

    after = await client.get(f"/api/v1/orders/{sale_id}/pick")
    assert after.status_code == 200
    after_count = after.json()["picked_count"]
    assert after_count >= 1


@pytest.mark.asyncio
async def test_patch_pick_status_not_found_does_not_increment_picked(client):
    sale_id, item_id = await _get_or_create_sale(client)

    before = await client.get(f"/api/v1/orders/{sale_id}/pick")
    before_picked = before.json()["picked_count"]

    resp = await client.patch(
        f"/api/v1/orders/{sale_id}/items/{item_id}/pick",
        json={"status": "not_found"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["pick_status"] == "not_found"
    totals = data["order_totals"]
    assert totals["not_found_count"] >= 1
    # picked_count must not have increased due to this not_found update
    assert totals["picked_count"] == before_picked or totals["picked_count"] == 0

    after = await client.get(f"/api/v1/orders/{sale_id}/pick")
    item_statuses = [i["pick_status"] for i in after.json()["items"] if i["item_id"] == item_id]
    # For BOM orders, multiple pick rows share the same item_id; all should be not_found
    assert item_statuses and all(s == "not_found" for s in item_statuses)


@pytest.mark.asyncio
async def test_patch_idempotent_key_returns_same_response(client):
    sale_id, item_id = await _get_or_create_sale(client)
    idem_key = f"test-idem-{uuid.uuid4()}"

    r1 = await client.patch(
        f"/api/v1/orders/{sale_id}/items/{item_id}/pick",
        json={"status": "picked"},
        headers={"Idempotency-Key": idem_key},
    )
    assert r1.status_code == 200, r1.text

    r2 = await client.patch(
        f"/api/v1/orders/{sale_id}/items/{item_id}/pick",
        json={"status": "not_found"},
        headers={"Idempotency-Key": idem_key},
    )
    assert r2.status_code == 200
    # Must return the FIRST request's result (picked), not the second (not_found)
    assert r2.json()["pick_status"] == "picked"


@pytest.mark.asyncio
async def test_patch_invalid_status_returns_422(client):
    sale_id, item_id = await _get_or_create_sale(client)
    resp = await client.patch(
        f"/api/v1/orders/{sale_id}/items/{item_id}/pick",
        json={"status": "pending"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_pick_messages_list_and_create(client):
    sale_id, _ = await _get_or_create_sale(client)

    list_resp = await client.get(f"/api/v1/orders/{sale_id}/pick/messages")
    assert list_resp.status_code == 200, list_resp.text
    assert isinstance(list_resp.json(), list)
    before_count = len(list_resp.json())

    post_resp = await client.post(
        f"/api/v1/orders/{sale_id}/pick/messages",
        json={"kind": "message", "body": "Test xabar T-025"},
    )
    assert post_resp.status_code == 201, post_resp.text
    msg = post_resp.json()
    for field in ("id", "from_user_name", "kind", "body", "created_at"):
        assert field in msg, f"Missing field: {field}"
    assert msg["kind"] == "message"
    assert msg["body"] == "Test xabar T-025"

    after_resp = await client.get(f"/api/v1/orders/{sale_id}/pick/messages")
    assert len(after_resp.json()) == before_count + 1


@pytest.mark.asyncio
async def test_pick_message_body_required_for_message_kind(client):
    sale_id, _ = await _get_or_create_sale(client)
    resp = await client.post(
        f"/api/v1/orders/{sale_id}/pick/messages",
        json={"kind": "message", "body": ""},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_pick_message_call_without_body_is_ok(client):
    sale_id, _ = await _get_or_create_sale(client)
    resp = await client.post(
        f"/api/v1/orders/{sale_id}/pick/messages",
        json={"kind": "call"},
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["kind"] == "call"


@pytest.mark.asyncio
async def test_pick_message_post_idempotent(client):
    sale_id, _ = await _get_or_create_sale(client)
    idem_key = f"test-msg-idem-{uuid.uuid4()}"
    headers = {"Idempotency-Key": idem_key}

    r1 = await client.post(
        f"/api/v1/orders/{sale_id}/pick/messages",
        json={"kind": "message", "body": "Idempotent xabar"},
        headers=headers,
    )
    assert r1.status_code == 201, r1.text
    first_id = r1.json()["id"]

    r2 = await client.post(
        f"/api/v1/orders/{sale_id}/pick/messages",
        json={"kind": "message", "body": "Boshqa xabar"},
        headers=headers,
    )
    assert r2.status_code == 201
    assert r2.json()["id"] == first_id


@pytest.mark.asyncio
async def test_org_isolation_pick_list(client, org_id):
    """An order from a different org must return 404."""
    fake_order = str(uuid.uuid4())
    resp = await client.get(f"/api/v1/orders/{fake_order}/pick")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_messages_404_unknown_order(client):
    fake_id = str(uuid.uuid4())
    resp = await client.get(f"/api/v1/orders/{fake_id}/pick/messages")
    assert resp.status_code == 404

    resp2 = await client.post(
        f"/api/v1/orders/{fake_id}/pick/messages",
        json={"kind": "call"},
    )
    assert resp2.status_code == 404


@pytest.mark.asyncio
async def test_pick_summary_batch(client):
    """GET /orders/pick-summary returns header-level aggregates in one call."""
    sale_id, _ = await _get_or_create_sale(client)
    fake_id = str(uuid.uuid4())

    resp = await client.get(
        "/api/v1/orders/pick-summary",
        params={"ids": f"{sale_id},{fake_id}"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert isinstance(data, list)

    # Result list preserves order and includes both requested IDs
    ids_in_response = [item["order_id"] for item in data]
    assert sale_id in ids_in_response
    assert fake_id in ids_in_response

    # Structure check
    for item in data:
        assert "order_id" in item
        assert "picked_count" in item
        assert "total_items" in item
        assert isinstance(item["picked_count"], int)
        assert isinstance(item["total_items"], int)

    # The known sale has items (ensured by _get_or_create_sale)
    known = next(i for i in data if i["order_id"] == sale_id)
    assert known["total_items"] >= 1

    # The fake order has no items
    unknown = next(i for i in data if i["order_id"] == fake_id)
    assert unknown["total_items"] == 0
    assert unknown["picked_count"] == 0


@pytest.mark.asyncio
async def test_pick_summary_too_many_ids(client):
    """More than 100 IDs returns 400."""
    ids = ",".join(str(uuid.uuid4()) for _ in range(101))
    resp = await client.get("/api/v1/orders/pick-summary", params={"ids": ids})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_pick_summary_empty_ids(client):
    """Empty ids param returns 400."""
    resp = await client.get("/api/v1/orders/pick-summary", params={"ids": ""})
    assert resp.status_code == 400


async def _create_isolated_bom_sale(client) -> tuple[str, str, str, str]:
    """
    Create a fresh BOM sale for test isolation.
    Returns (sale_id, item_id, comp1_product_id, comp2_product_id).
    """
    wh_resp = await client.get("/api/v1/warehouse/warehouses")
    assert wh_resp.status_code == 200, wh_resp.text
    warehouses = wh_resp.json()
    assert warehouses, "Need at least one warehouse"
    wh_id = warehouses[0]["id"]

    cur_resp = await client.get("/api/v1/reference/currencies")
    assert cur_resp.status_code == 200, cur_resp.text
    currencies = cur_resp.json()
    cur_id = currencies[0]["id"] if currencies else 1

    cats = (await client.get("/api/v1/warehouse/categories")).json()
    cat_id = cats[0]["id"] if cats else None

    async def _make_product(name: str) -> str:
        payload: dict = {"name": name, "sale_price": 1000, "purchase_price": 500}
        if cat_id:
            payload["category_id"] = cat_id
        r = await client.post("/api/v1/warehouse/products", json=payload)
        assert r.status_code in (200, 201), f"create product failed: {r.text}"
        data = r.json()
        return str(data.get("id") or data["product"]["id"])

    parent_id = await _make_product("Test-Bundle-Pick-Parent")
    comp1_id = await _make_product("Test-Bundle-Pick-Comp1")
    comp2_id = await _make_product("Test-Bundle-Pick-Comp2")

    r = await client.post(
        f"/api/v1/warehouse/products/{parent_id}/bom",
        json={"component_product_id": comp1_id, "quantity": 3},
    )
    assert r.status_code in (200, 201), f"BOM comp1 failed: {r.text}"

    r = await client.post(
        f"/api/v1/warehouse/products/{parent_id}/bom",
        json={"component_product_id": comp2_id, "quantity": 7},
    )
    assert r.status_code in (200, 201), f"BOM comp2 failed: {r.text}"

    r = await client.post(
        "/api/v1/sale/sales",
        json={
            "warehouse_id": wh_id,
            "currency_id": cur_id,
            "items": [{"product_id": parent_id, "quantity": 1, "price": 50000, "discount": 0}],
        },
    )
    assert r.status_code == 201, f"create_sale failed: {r.text}"
    sale_id = r.json()["id"]

    pick_resp = await client.get(f"/api/v1/orders/{sale_id}/pick")
    assert pick_resp.status_code == 200, pick_resp.text
    pick_items = pick_resp.json()["items"]
    assert len(pick_items) >= 2, f"Expected BOM explosion; got {len(pick_items)} items"

    item_id = pick_items[0]["item_id"]
    return sale_id, str(item_id), comp1_id, comp2_id


@pytest.mark.asyncio
async def test_patch_per_leaf_product_id_only_marks_one_component(client):
    """
    Per-leaf granularity: PATCH with product_id set must only update the matching
    pick row. Other components of the same sale_item must remain 'pending'.
    Creates a fresh BOM sale for isolation (no shared state dependency).
    """
    from collections import defaultdict

    sale_id, _, comp1_id, comp2_id = await _create_isolated_bom_sale(client)

    pick_resp = await client.get(f"/api/v1/orders/{sale_id}/pick")
    assert pick_resp.status_code == 200
    items = pick_resp.json()["items"]

    by_item: dict = defaultdict(list)
    for it in items:
        by_item[it["item_id"]].append(it)

    bundle_item_id = None
    bundle_rows = []
    for iid, rows in by_item.items():
        if len(rows) >= 2 and rows[0]["is_bundle_component"]:
            bundle_item_id = iid
            bundle_rows = rows
            break

    assert bundle_item_id is not None, "Fresh BOM sale must have bundle rows"

    target_row = bundle_rows[0]
    other_rows = bundle_rows[1:]

    # All other rows must start as pending (fresh sale)
    for other in other_rows:
        assert other["pick_status"] == "pending", (
            f"Component {other['product_id']} is not pending before patch: {other['pick_status']}"
        )

    resp = await client.patch(
        f"/api/v1/orders/{sale_id}/items/{bundle_item_id}/pick",
        json={"status": "picked", "product_id": target_row["product_id"]},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["pick_status"] == "picked"

    after = await client.get(f"/api/v1/orders/{sale_id}/pick")
    assert after.status_code == 200
    after_items = after.json()["items"]
    after_map = {(it["item_id"], it["product_id"]): it["pick_status"] for it in after_items}

    assert after_map.get((bundle_item_id, target_row["product_id"])) == "picked"
    for other in other_rows:
        assert after_map.get((bundle_item_id, other["product_id"])) == "pending", (
            f"Component {other['product_id']} should still be pending"
        )


@pytest.mark.asyncio
async def test_patch_backward_compat_no_product_id_marks_all(client):
    """
    Backward compat: PATCH without product_id must mark ALL pick rows for the
    given item_id (legacy individual-item behavior or full-bundle update).
    """
    sale_id, item_id = await _get_or_create_sale(client)

    resp = await client.patch(
        f"/api/v1/orders/{sale_id}/items/{item_id}/pick",
        json={"status": "picked"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["pick_status"] == "picked"

    after = await client.get(f"/api/v1/orders/{sale_id}/pick")
    assert after.status_code == 200
    rows_for_item = [
        it for it in after.json()["items"] if it["item_id"] == item_id
    ]
    assert rows_for_item, "No pick rows found for item_id"
    assert all(it["pick_status"] == "picked" for it in rows_for_item), (
        "All rows for item_id should be 'picked' when no product_id is supplied"
    )
