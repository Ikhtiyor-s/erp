# T-024 — Backend: Warehouse cells CRUD + product default_cell_id

**Owner**: backend-dev
**Size**: S
**Depends on**: T-020, T-021

---

## Goal

Implement CRUD for `warehouse_cells` nested under racks, and expose `default_cell_id` on product read/write endpoints.

---

## Files likely touched

- `apps/api/app/modules/warehouse/router.py` — cells route group under `/warehouse/racks/{rack_id}/cells`
- `apps/api/app/modules/warehouse/router.py` or product router — add `default_cell_id` to product response/update schema

---

## Acceptance criteria

- [ ] `GET /warehouse/racks/{rack_id}/cells` returns cells `{id, code, is_active}` for the rack; rack must belong to `organization_id` (404 otherwise)
- [ ] `POST /warehouse/racks/{rack_id}/cells` body `{code}` — inserts cell; 409 on duplicate `(rack_id, code)` within org; 201 response
- [ ] `PATCH /warehouse/racks/{rack_id}/cells/{cid}` updates `code` and/or `is_active`; validates uniqueness on code change
- [ ] `DELETE /warehouse/racks/{rack_id}/cells/{cid}` sets `is_active=False`; 204; if any product has `default_cell_id` pointing here, cell is soft-deleted (not hard-deleted) to preserve references
- [ ] Product GET endpoints include `default_cell_id` and a `default_cell_code` (joined from `warehouse_cells.code`) in response
- [ ] Product PATCH/PUT accepts `default_cell_id` (nullable UUID); validates cell belongs to same `organization_id` before saving; 422 if not
- [ ] All cells endpoints use `warehouse.cell.view` for GETs and `warehouse.cell.manage` for writes
- [ ] `pytest apps/api/tests/test_warehouse_cells.py` covers: create, duplicate code rejection, cross-org isolation, soft delete with product reference
