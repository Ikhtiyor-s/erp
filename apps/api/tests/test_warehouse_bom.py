"""
Integration tests for BOM CRUD + cycle detection (T-022).
Requires a running API with the test org seeded (qa@example.com / Qa12345!).
Run inside container: docker exec erp-api pytest apps/api/tests/test_warehouse_bom.py -v
"""
import pytest
import pytest_asyncio
import httpx

from tests.conftest import API_URL


pytestmark = pytest.mark.asyncio

_COUNTER = {"n": 0}


def _unique(prefix: str) -> str:
    _COUNTER["n"] += 1
    return f"{prefix}_{_COUNTER['n']}"


async def _make_product(client: httpx.AsyncClient, name: str) -> str:
    r = await client.post(
        "/api/v1/warehouse/products",
        json={"name": name, "purchase_price": "100"},
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------

async def test_bom_add_and_list(client: httpx.AsyncClient):
    parent = await _make_product(client, _unique("_BOM_PARENT"))
    comp = await _make_product(client, _unique("_BOM_COMP"))

    r = await client.post(
        f"/api/v1/warehouse/products/{parent}/bom",
        json={"component_product_id": comp, "quantity": 4.0, "notes": "test note"},
    )
    assert r.status_code == 201, r.text
    data = r.json()
    bom_id = data["id"]
    assert data["component_product_id"] == comp
    assert float(data["quantity"]) == 4.0
    assert data["notes"] == "test note"

    r = await client.get(f"/api/v1/warehouse/products/{parent}/bom")
    assert r.status_code == 200, r.text
    items = r.json()
    ids = [i["id"] for i in items]
    assert bom_id in ids


async def test_bom_patch(client: httpx.AsyncClient):
    parent = await _make_product(client, _unique("_BOM_PATCH_PAR"))
    comp = await _make_product(client, _unique("_BOM_PATCH_COMP"))

    r = await client.post(
        f"/api/v1/warehouse/products/{parent}/bom",
        json={"component_product_id": comp, "quantity": 2.0},
    )
    assert r.status_code == 201, r.text
    bom_id = r.json()["id"]

    r = await client.patch(
        f"/api/v1/warehouse/products/{parent}/bom/{bom_id}",
        json={"quantity": 7.5, "notes": "patched"},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert float(data["quantity"]) == 7.5
    assert data["notes"] == "patched"


async def test_bom_delete(client: httpx.AsyncClient):
    parent = await _make_product(client, _unique("_BOM_DEL_PAR"))
    comp = await _make_product(client, _unique("_BOM_DEL_COMP"))

    r = await client.post(
        f"/api/v1/warehouse/products/{parent}/bom",
        json={"component_product_id": comp, "quantity": 1.0},
    )
    assert r.status_code == 201, r.text
    bom_id = r.json()["id"]

    r = await client.delete(f"/api/v1/warehouse/products/{parent}/bom/{bom_id}")
    assert r.status_code == 204, r.text

    r = await client.get(f"/api/v1/warehouse/products/{parent}/bom")
    assert r.status_code == 200
    ids = [i["id"] for i in r.json()]
    assert bom_id not in ids


# ---------------------------------------------------------------------------
# Cycle detection
# ---------------------------------------------------------------------------

async def test_bom_self_loop_rejected(client: httpx.AsyncClient):
    """A product cannot be its own component."""
    product = await _make_product(client, _unique("_BOM_SELF"))
    r = await client.post(
        f"/api/v1/warehouse/products/{product}/bom",
        json={"component_product_id": product, "quantity": 1.0},
    )
    assert r.status_code == 422, r.text
    assert "o'z-o'ziga" in r.json()["detail"]


async def test_bom_direct_cycle_rejected(client: httpx.AsyncClient):
    """A -> B then B -> A must be rejected (direct cycle)."""
    a = await _make_product(client, _unique("_BOM_A"))
    b = await _make_product(client, _unique("_BOM_B"))

    r = await client.post(
        f"/api/v1/warehouse/products/{a}/bom",
        json={"component_product_id": b, "quantity": 1.0},
    )
    assert r.status_code == 201, r.text

    r = await client.post(
        f"/api/v1/warehouse/products/{b}/bom",
        json={"component_product_id": a, "quantity": 1.0},
    )
    assert r.status_code == 422, r.text
    assert "cycle" in r.json()["detail"].lower() or "davriy" in r.json()["detail"]


async def test_bom_max_depth_exceeded(client: httpx.AsyncClient):
    """Chain of 11 products (depth > 10) must be rejected on the last link."""
    # Build a chain: p0 -> p1 -> p2 -> ... -> p10
    # Inserting p0 as component of itself via p10->p0 would be a cycle,
    # but we want to test depth. Instead we build a linear chain of 11 nodes
    # and verify the 11th insertion (which would exceed max_depth=10) is rejected.
    products = []
    for i in range(12):
        pid = await _make_product(client, _unique(f"_BOM_DEPTH_{i}"))
        products.append(pid)

    # Build chain: products[0] is root; products[i] is component of products[i-1]
    for i in range(1, 11):
        r = await client.post(
            f"/api/v1/warehouse/products/{products[i-1]}/bom",
            json={"component_product_id": products[i], "quantity": 1.0},
        )
        assert r.status_code == 201, f"Step {i} failed: {r.text}"

    # The 11th link would make root->...->products[10], depth=10, then adding
    # products[11] as component of products[10] would be depth 11 (> max_depth).
    # But cycle check starts DFS from the new component. The chain is:
    # products[0]->products[1]->...->products[10]
    # Adding products[10]->products[11]: DFS from products[11] goes nowhere (no outgoing edges).
    # depth check is about the path from new_component's subtree back through the graph.
    # To hit max_depth, we need the new component to have a very deep subtree.
    # Instead, test that adding a 12th link in the linear chain (where subtree is 11 deep)
    # triggers the depth exceeded error.
    # Build reverse chain through the cycle check: the "parent" is products[0],
    # "new_component" is products[10]. DFS from products[10] finds no children yet.
    # We need a chain that exceeds max_depth=10 on the DFS traversal.
    # Build: products[11] is parent of a 10-deep chain, then try to add products[0]
    # as a component of products[11] (which would then connect to the 10-deep chain).
    # Actually the simpler test: build a linear chain 11 products[0]->p1->...->p10,
    # then try to add products[0] as component of products[10] — this is a cycle.
    # For depth test: create 11 separate levels and verify insert #12 is rejected.
    #
    # Real depth test: new_component has depth > 10 descendants.
    # Build a separate 11-level deep tree and try to use the deepest as a component.
    deep = []
    for i in range(12):
        pid = await _make_product(client, _unique(f"_BOM_DEEP_{i}"))
        deep.append(pid)
    for i in range(1, 11):
        r = await client.post(
            f"/api/v1/warehouse/products/{deep[i-1]}/bom",
            json={"component_product_id": deep[i], "quantity": 1.0},
        )
        assert r.status_code == 201, f"Deep step {i}: {r.text}"

    # deep[0]->deep[1]->...->deep[10] is a 10-level chain (depth=10).
    # Adding deep[11] as component of deep[10] would make the chain 11 levels deep
    # (depth 11 from deep[0]), exceeding max_depth=10. Must be rejected with 422.
    r = await client.post(
        f"/api/v1/warehouse/products/{deep[10]}/bom",
        json={"component_product_id": deep[11], "quantity": 1.0},
    )
    assert r.status_code == 422, r.text
    assert "darajasi" in r.json()["detail"] or "depth" in r.json()["detail"].lower()


async def test_bom_duplicate_rejected(client: httpx.AsyncClient):
    """Adding the same component twice returns 409."""
    parent = await _make_product(client, _unique("_BOM_DUP_PAR"))
    comp = await _make_product(client, _unique("_BOM_DUP_COMP"))

    r = await client.post(
        f"/api/v1/warehouse/products/{parent}/bom",
        json={"component_product_id": comp, "quantity": 1.0},
    )
    assert r.status_code == 201, r.text

    r = await client.post(
        f"/api/v1/warehouse/products/{parent}/bom",
        json={"component_product_id": comp, "quantity": 2.0},
    )
    assert r.status_code == 409, r.text
    assert "allaqachon" in r.json()["detail"]


async def test_bom_parent_not_in_org_returns_404(client: httpx.AsyncClient):
    """GET BOM for non-existent parent product returns 404."""
    fake_id = "00000000-0000-0000-0000-000000000001"
    r = await client.get(f"/api/v1/warehouse/products/{fake_id}/bom")
    assert r.status_code == 404, r.text


async def test_bom_delete_nonexistent_returns_404(client: httpx.AsyncClient):
    parent = await _make_product(client, _unique("_BOM_404_PAR"))
    r = await client.delete(f"/api/v1/warehouse/products/{parent}/bom/999999999")
    assert r.status_code == 404, r.text
