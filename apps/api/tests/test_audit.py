"""Audit log middleware tests."""
import pytest


async def test_audit_logs_endpoint_lists_recent(client):
    resp = await client.get("/api/v1/audit/logs?limit=10")
    assert resp.status_code == 200
    data = resp.json()
    assert "rows" in data
    assert "total" in data
    assert isinstance(data["rows"], list)


async def test_audit_entities_endpoint(client):
    resp = await client.get("/api/v1/audit/entities")
    assert resp.status_code == 200
    items = resp.json()
    assert isinstance(items, list)


async def test_audit_actions_endpoint(client):
    resp = await client.get("/api/v1/audit/actions")
    assert resp.status_code == 200
    items = resp.json()
    assert isinstance(items, list)


async def test_create_action_appears_in_audit(client):
    """Creating a category via warehouse module should trigger audit middleware."""
    # Count before
    before = await client.get("/api/v1/audit/logs?action=create&entity=categories")
    before_total = before.json()["total"]

    # Create a fresh category
    import uuid
    name = f"Test {uuid.uuid4().hex[:6]}"
    create = await client.post("/api/v1/warehouse/categories", json={"name": name})
    assert create.status_code in (200, 201)

    # Count after — should be at least one more
    after = await client.get("/api/v1/audit/logs?action=create&entity=categories")
    assert after.json()["total"] >= before_total + 1, "Audit middleware didn't log create"


async def test_audit_filter_by_entity(client):
    resp = await client.get("/api/v1/audit/logs?entity=sales&limit=5")
    assert resp.status_code == 200
    for row in resp.json()["rows"]:
        assert row["entity"] == "sales"
