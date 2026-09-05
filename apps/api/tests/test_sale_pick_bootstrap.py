"""
T-040 / T-041 — BOM explode helper + pick_items bootstrap on create_sale.

All tests run against the live API (integration style, same pattern as test_sales.py).
Requires the ANIQ demo seed to have at least one warehouse, one currency, and the
DB migration (Sprint 3 schema patches) already applied.

Test matrix:
  1. Sale with non-BOM product → 1 pick_item, parent_product_id NULL
  2. Sale with BOM product (Stol → Yog'och×4, Bolt×20) × qty=2
       → 2 pick_items: Yog'och×8, Bolt×40, parent_product_id = Stol.id
  3. Mixed sale (BOM product × 1 + non-BOM product × 10)
       → 2+1 = 3 pick_items total
  4. Nested BOM (A → B → C): A × 2 → only C with quantity = B.qty × 2
  5. GET /orders/{oid}/pick returns parent_product_id and parent_product_name fields
  6. pick_items rows have product_id column set (not NULL for individual items)
"""
import pytest
import httpx

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _get_seed(client: httpx.AsyncClient):
    """Return (warehouse_id, currency_id) from demo seed."""
    wh = (await client.get("/api/v1/warehouse/warehouses")).json()
    assert wh, "Seed must have a warehouse"
    cur = (await client.get("/api/v1/reference/currencies")).json()
    cur_id = cur[0]["id"] if cur else 1
    return wh[0]["id"], cur_id


async def _create_product(client: httpx.AsyncClient, name: str, org_id: str) -> str:
    """Create a minimal product and return its UUID string."""
    # Find or create a category
    cats = (await client.get("/api/v1/warehouse/categories")).json()
    cat_id = cats[0]["id"] if cats else None

    payload: dict = {"name": name, "sale_price": 1000, "purchase_price": 500}
    if cat_id:
        payload["category_id"] = cat_id

    resp = await client.post("/api/v1/warehouse/products", json=payload)
    assert resp.status_code in (200, 201), f"create product failed: {resp.text}"
    data = resp.json()
    # endpoint may return {"id": ...} or the full object
    return str(data.get("id") or data["product"]["id"])


async def _create_bom_entry(
    client: httpx.AsyncClient,
    parent_id: str,
    component_id: str,
    quantity: float,
) -> None:
    resp = await client.post(
        f"/api/v1/warehouse/products/{parent_id}/bom",
        json={"component_product_id": component_id, "quantity": quantity},
    )
    assert resp.status_code in (200, 201), f"BOM add failed: {resp.text}"


async def _create_sale(
    client: httpx.AsyncClient,
    warehouse_id: int,
    currency_id: int,
    items: list[dict],
) -> str:
    resp = await client.post(
        "/api/v1/sale/sales",
        json={
            "warehouse_id": warehouse_id,
            "currency_id": currency_id,
            "items": items,
        },
    )
    assert resp.status_code == 201, f"create_sale failed: {resp.text}"
    return resp.json()["id"]


async def _get_pick_items_from_db(client: httpx.AsyncClient, order_id: str) -> list[dict]:
    """Use the pick endpoint to read pick items."""
    resp = await client.get(f"/api/v1/orders/{order_id}/pick")
    assert resp.status_code == 200, f"GET pick failed: {resp.text}"
    return resp.json()["items"]


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


async def test_non_bom_product_creates_single_pick_item(client, org_id):
    """Non-BOM product sale → exactly 1 pick_item with parent_product_id = null."""
    wh_id, cur_id = await _get_seed(client)

    prod_id = await _create_product(client, "Test-NoBOM-Product", org_id)

    sale_id = await _create_sale(
        client, wh_id, cur_id,
        [{"product_id": prod_id, "quantity": 5, "price": 1000, "discount": 0}],
    )

    items = await _get_pick_items_from_db(client, sale_id)
    assert len(items) == 1, f"Expected 1 pick item, got {len(items)}: {items}"
    item = items[0]
    assert item["parent_product_id"] is None
    assert item["is_bundle_component"] is False
    assert float(item["quantity"]) == 5.0


async def test_bom_product_explodes_into_leaf_components(client, org_id):
    """Sale of BOM product × 2 → pick_items for each leaf × multiplied qty."""
    wh_id, cur_id = await _get_seed(client)

    parent_id = await _create_product(client, "Test-Stol", org_id)
    wood_id = await _create_product(client, "Test-Yogoch", org_id)
    bolt_id = await _create_product(client, "Test-Bolt", org_id)

    await _create_bom_entry(client, parent_id, wood_id, 4)
    await _create_bom_entry(client, parent_id, bolt_id, 20)

    sale_id = await _create_sale(
        client, wh_id, cur_id,
        [{"product_id": parent_id, "quantity": 2, "price": 100000, "discount": 0}],
    )

    items = await _get_pick_items_from_db(client, sale_id)
    assert len(items) == 2, f"Expected 2 pick items (leaf components), got {len(items)}: {items}"

    qty_map = {i["product_id"]: float(i["quantity"]) for i in items}
    assert qty_map.get(wood_id) == pytest.approx(8.0), f"Wood qty wrong: {qty_map}"
    assert qty_map.get(bolt_id) == pytest.approx(40.0), f"Bolt qty wrong: {qty_map}"

    for item in items:
        assert item["parent_product_id"] == parent_id
        assert item["is_bundle_component"] is True


async def test_mixed_sale_creates_correct_pick_items(client, org_id):
    """Sale with one BOM + one non-BOM product → 2+1 = 3 pick items."""
    wh_id, cur_id = await _get_seed(client)

    bom_parent = await _create_product(client, "Test-BOM-Mixed", org_id)
    comp1 = await _create_product(client, "Test-Comp1-Mixed", org_id)
    comp2 = await _create_product(client, "Test-Comp2-Mixed", org_id)
    individual = await _create_product(client, "Test-Individual-Mixed", org_id)

    await _create_bom_entry(client, bom_parent, comp1, 3)
    await _create_bom_entry(client, bom_parent, comp2, 7)

    sale_id = await _create_sale(
        client, wh_id, cur_id,
        [
            {"product_id": bom_parent, "quantity": 1, "price": 50000, "discount": 0},
            {"product_id": individual, "quantity": 10, "price": 2000, "discount": 0},
        ],
    )

    items = await _get_pick_items_from_db(client, sale_id)
    assert len(items) == 3, f"Expected 3 pick items, got {len(items)}: {items}"

    bundle_items = [i for i in items if i["is_bundle_component"]]
    individual_items = [i for i in items if not i["is_bundle_component"]]
    assert len(bundle_items) == 2
    assert len(individual_items) == 1
    assert individual_items[0]["product_id"] == individual


async def test_nested_bom_returns_only_leaf(client, org_id):
    """Nested A → B → C: selling A × 2 should yield only C (leaf), not B."""
    wh_id, cur_id = await _get_seed(client)

    prod_a = await _create_product(client, "Test-Nested-A", org_id)
    prod_b = await _create_product(client, "Test-Nested-B", org_id)
    prod_c = await _create_product(client, "Test-Nested-C", org_id)

    # A → B (qty=3), B → C (qty=5)  → selling A×2 should give C×(3×5×2)=30
    await _create_bom_entry(client, prod_a, prod_b, 3)
    await _create_bom_entry(client, prod_b, prod_c, 5)

    sale_id = await _create_sale(
        client, wh_id, cur_id,
        [{"product_id": prod_a, "quantity": 2, "price": 1000, "discount": 0}],
    )

    items = await _get_pick_items_from_db(client, sale_id)
    product_ids_in_pick = {i["product_id"] for i in items}

    # Only leaf C should appear; B is intermediate and must not be in pick items
    assert prod_b not in product_ids_in_pick, f"Intermediate B should not appear: {items}"
    assert prod_c in product_ids_in_pick, f"Leaf C must appear: {items}"
    c_item = next(i for i in items if i["product_id"] == prod_c)
    assert float(c_item["quantity"]) == pytest.approx(30.0), f"C qty should be 30: {c_item}"


async def test_pick_list_returns_parent_fields(client, org_id):
    """GET /orders/{oid}/pick response includes parent_product_id and parent_product_name."""
    wh_id, cur_id = await _get_seed(client)

    parent_id = await _create_product(client, "Test-BOM-Fields-Parent", org_id)
    comp_id = await _create_product(client, "Test-BOM-Fields-Comp", org_id)
    await _create_bom_entry(client, parent_id, comp_id, 2)

    sale_id = await _create_sale(
        client, wh_id, cur_id,
        [{"product_id": parent_id, "quantity": 1, "price": 1000, "discount": 0}],
    )

    resp = await client.get(f"/api/v1/orders/{sale_id}/pick")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    items = data["items"]
    assert len(items) == 1
    item = items[0]

    assert "parent_product_id" in item, f"parent_product_id missing: {item}"
    assert "parent_product_name" in item, f"parent_product_name missing: {item}"
    assert "is_bundle_component" in item, f"is_bundle_component missing: {item}"
    assert item["parent_product_id"] == parent_id
    assert item["is_bundle_component"] is True
    assert item["parent_product_name"] is not None


async def test_totals_correct_for_bom_order(client, org_id):
    """
    Sale: Stol (BOM: Yogoch×4, Bolt×20) × qty=2 → 2 pick_items in order_pick_items.
    total_items must equal 2 (count from order_pick_items, not inflated by JOIN).
    After picking 1 item: picked_count=1, total_items still 2.
    """
    wh_id, cur_id = await _get_seed(client)

    stol_id = await _create_product(client, "Test-Totals-Stol", org_id)
    yogoch_id = await _create_product(client, "Test-Totals-Yogoch", org_id)
    bolt_id = await _create_product(client, "Test-Totals-Bolt", org_id)

    await _create_bom_entry(client, stol_id, yogoch_id, 4)
    await _create_bom_entry(client, stol_id, bolt_id, 20)

    sale_id = await _create_sale(
        client, wh_id, cur_id,
        [{"product_id": stol_id, "quantity": 2, "price": 100000, "discount": 0}],
    )

    pick_resp = await client.get(f"/api/v1/orders/{sale_id}/pick")
    assert pick_resp.status_code == 200, pick_resp.text
    data = pick_resp.json()

    # total_items must be 2 (one per leaf component), not inflated by JOIN
    assert data["total_items"] == 2, (
        f"Expected total_items=2 (BOM sprint-3 mode), got {data['total_items']}"
    )
    assert data["picked_count"] == 0
    assert data["not_found_count"] == 0

    # Pick one of the two leaf components
    first_item_id = data["items"][0]["item_id"]
    patch_resp = await client.patch(
        f"/api/v1/orders/{sale_id}/items/{first_item_id}/pick",
        json={"status": "picked"},
    )
    assert patch_resp.status_code == 200, patch_resp.text
    totals = patch_resp.json()["order_totals"]

    assert totals["total_items"] == 2, f"total_items must remain 2 after pick: {totals}"
    # PATCH marks ALL pick_items for that item_id (all BOM leaf components atomically)
    assert totals["picked_count"] == 2, f"picked_count must be 2 (all leaves picked): {totals}"
    assert totals["not_found_count"] == 0
