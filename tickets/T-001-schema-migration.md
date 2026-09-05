# T-001 — Schema Migration: Warehouse Types, Rows, Racks, Transfers, Requests

## Goal
Add all new tables and columns defined in SPEC.md to `schema_patches.py` so every subsequent ticket has a stable DB foundation.

## Owner Role
`backend-dev`

## Depends On
`none`

## Estimated Size
S

## Files Likely Touched
- `apps/api/app/db/schema_patches.py` — append new PATCHES entries (idempotent, IF NOT EXISTS)

## Acceptance Criteria
- [ ] `warehouse_types` table created with unique index on `(organization_id, name)`.
- [ ] `warehouse_rows` table created with index on `warehouse_id`.
- [ ] `warehouse_racks` table created with index on `row_id`.
- [ ] `internal_transfers` table created with index on `(organization_id, status)`.
- [ ] `internal_transfer_items` table created.
- [ ] `product_requests` table created with index on `(organization_id, status)`.
- [ ] `product_request_items` table created.
- [ ] `warehouses.type_id` column added (nullable FK to `warehouse_types`).
- [ ] `products.default_rack_id` column added (nullable FK to `warehouse_racks`).
- [ ] `products.product_type` column added (VARCHAR(100), nullable).
- [ ] All patches are idempotent: running twice does not error.
- [ ] `docker compose restart api` applies patches cleanly (check logs, no exceptions).
- [ ] `docker exec erp-postgres psql -U erp -d erp -c "\d warehouse_types"` returns correct schema.

## How We'll Know It's Done
Run `docker exec erp-postgres psql -U erp -d erp` and verify all 7 new tables exist and `warehouses` + `products` have the new columns. API startup log shows no patch errors.
