# T-004 — Backend: Warehouse Types, Rows, Racks CRUD Endpoints

## Goal
Implement all API endpoints for warehouse types, rows inside a warehouse, and racks inside a row, with full multi-tenant filtering and RBAC guards.

## Owner Role
`backend-dev`

## Depends On
`T-001`, `T-002`

## Estimated Size
M

## Files Likely Touched
- `apps/api/app/modules/warehouse/router.py` — append new route handlers (do NOT break existing endpoints; append below existing sections)

## Endpoint Specifications

### Warehouse Types
```
GET    /warehouse/types              — list active types for org
POST   /warehouse/types              — create type (name, code)
PUT    /warehouse/types/{id}         — update
DELETE /warehouse/types/{id}         — soft delete (is_active=FALSE)
```
RBAC: GET requires `warehouse.type.view`; write requires `warehouse.type.manage`.

### Warehouse Rows
```
GET    /warehouse/{wid}/rows         — list rows for warehouse (verify wid belongs to org)
POST   /warehouse/{wid}/rows         — create row (name, sort_order)
PUT    /warehouse/rows/{rid}         — update (verify org via JOIN)
DELETE /warehouse/rows/{rid}         — hard delete (verify no racks exist, else 409)
```
RBAC: GET requires `warehouse.rack.view`; write requires `warehouse.rack.manage`.

### Warehouse Racks
```
GET    /warehouse/rows/{rid}/racks   — list racks in row
POST   /warehouse/rows/{rid}/racks   — create rack (name, sort_order)
PUT    /warehouse/racks/{rack_id}    — update
DELETE /warehouse/racks/{rack_id}    — hard delete (verify no products linked, else 409)
```
RBAC: same as rows.

### Warehouses enhancement
- `GET /warehouse/warehouses` must now also return `type_id` and `type_name` (LEFT JOIN warehouse_types).
- `POST/PUT /warehouse/warehouses` must accept optional `type_id`.

## Acceptance Criteria
- [ ] All CRUD endpoints return correct data scoped to `organization_id`.
- [ ] Creating a row with a `warehouse_id` that belongs to another org returns 404 (not 403).
- [ ] Deleting a row that has racks returns HTTP 409 with message.
- [ ] Deleting a rack that is referenced by a product's `default_rack_id` returns HTTP 409.
- [ ] Listing warehouses response includes `type_id` and `type_name`.
- [ ] RBAC middleware blocks unauthorized roles (test with viewer role on POST).
- [ ] No `from __future__ import annotations` at top of file (slowapi compatibility).
- [ ] `docker exec erp-api pytest apps/api/tests/ -v` passes.

## How We'll Know It's Done
`POST /warehouse/types` with valid org token creates a type; `GET /warehouse/{wid}/rows` with a different org token returns empty list, not the first org's rows.
