# T-022 — Backend: BOM CRUD endpoints + cycle detection

**Owner**: backend-dev
**Size**: M
**Depends on**: T-020, T-021

---

## Goal

Implement GET/POST/PATCH/DELETE endpoints for `product_bom` with DFS-based cycle detection.

---

## Files likely touched

- `apps/api/app/modules/warehouse/router.py` — new BOM route group
- `apps/api/app/modules/warehouse/service.py` — `_bom_has_cycle(org_id, parent_id, new_component_id, db)` helper

---

## Acceptance criteria

- [ ] `GET /warehouse/products/{id}/bom` returns list of `{id, component_product_id, component_name, quantity, unit_id, unit_name, notes}` filtered by `organization_id`
- [ ] `POST /warehouse/products/{id}/bom` body `{component_product_id, quantity, unit_id, notes}` — inserts row; returns 201
- [ ] Before insert: cycle check via DFS (walk existing BOM rows for org; if `new_component_id` can reach `parent_id`, return 422 `{detail: "BOM davriy bog'liqlik aniqlandi (cycle detected)"}`)
- [ ] Parent product and component product both validated to belong to `organization_id`; 404 if not found
- [ ] `PATCH /warehouse/products/{id}/bom/{bom_id}` allows updating `quantity`, `unit_id`, `notes` only (not product refs); returns updated row
- [ ] `DELETE /warehouse/products/{id}/bom/{bom_id}` removes row; 204 response
- [ ] All endpoints use `dependencies=[Depends(require_permission("warehouse.bom.view"))]` for GET and `"warehouse.bom.manage"` for write operations
- [ ] Duplicate component (same parent+component) returns 409
- [ ] `pytest apps/api/tests/test_warehouse_bom.py` passes covering: normal add, cycle detection, duplicate, cross-org isolation
