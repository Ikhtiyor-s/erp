"""Sale CRUD + payment + PDF export tests."""
import pytest


async def test_list_sales(client):
    resp = await client.get("/api/v1/sale/sales?limit=5")
    assert resp.status_code == 200
    rows = resp.json()
    assert isinstance(rows, list)


async def test_get_sale_404_for_random_id(client):
    fake_id = "00000000-0000-0000-0000-000000000000"
    resp = await client.get(f"/api/v1/sale/sales/{fake_id}")
    assert resp.status_code == 404


async def test_dashboard_returns_kpis(client):
    resp = await client.get("/api/v1/sale/dashboard")
    assert resp.status_code == 200
    data = resp.json()
    assert "kpi" in data
    kpi = data["kpi"]
    for key in ("today_revenue", "today_count", "week_revenue", "month_revenue"):
        assert key in kpi


async def test_create_and_pay_sale(client):
    # Need a warehouse + a product to create a sale
    wh_resp = await client.get("/api/v1/warehouse/warehouses")
    assert wh_resp.status_code == 200
    warehouses = wh_resp.json()
    assert warehouses, "Test demo seed must include at least one warehouse"
    wh_id = warehouses[0]["id"]

    pr_resp = await client.get("/api/v1/warehouse/products?limit=1")
    assert pr_resp.status_code == 200
    products = pr_resp.json()
    assert products, "Test demo seed must include at least one product"
    p_id = products[0]["id"]

    # Resolve a currency
    cur_resp = await client.get("/api/v1/reference/currencies")
    currencies = cur_resp.json() if cur_resp.status_code == 200 else []
    cur_id = currencies[0]["id"] if currencies else 1

    # Create the sale
    create_resp = await client.post(
        "/api/v1/sale/sales",
        json={
            "warehouse_id": wh_id,
            "currency_id": cur_id,
            "items": [{"product_id": p_id, "quantity": 1, "price": 12345, "discount": 0}],
        },
    )
    assert create_resp.status_code == 201, create_resp.text
    sale_id = create_resp.json()["id"]

    # Fetch it back
    get_resp = await client.get(f"/api/v1/sale/sales/{sale_id}")
    assert get_resp.status_code == 200
    head = get_resp.json()["head"]
    assert float(head["total_amount"]) == 12345
    assert len(get_resp.json()["items"]) == 1

    # PDF endpoint should return application/pdf
    pdf_resp = await client.get(f"/api/v1/sale/sales/{sale_id}/pdf?fmt=a4")
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers["content-type"].startswith("application/pdf")
    assert pdf_resp.content[:4] == b"%PDF"

    # xlsx endpoint
    xlsx_resp = await client.get(f"/api/v1/sale/sales/{sale_id}/xlsx")
    assert xlsx_resp.status_code == 200
    # xlsx is a ZIP — magic bytes PK\x03\x04
    assert xlsx_resp.content[:4] == b"PK\x03\x04"

    # Cancel the sale (cleanup)
    cancel_resp = await client.post(f"/api/v1/sale/sales/{sale_id}/cancel")
    assert cancel_resp.status_code == 200


async def test_duplicate_sale(client):
    sales_resp = await client.get("/api/v1/sale/sales?limit=1")
    sales = sales_resp.json()
    if not sales:
        pytest.skip("No sales to duplicate")
    sale_id = sales[0]["id"]

    dup_resp = await client.post(f"/api/v1/sale/sales/{sale_id}/duplicate")
    assert dup_resp.status_code == 201
    new_id = dup_resp.json()["id"]
    assert new_id != sale_id

    # Verify the dup is a draft
    get_resp = await client.get(f"/api/v1/sale/sales/{new_id}")
    assert get_resp.json()["head"]["status"] == "draft"
