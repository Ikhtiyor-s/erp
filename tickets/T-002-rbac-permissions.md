# T-002 — RBAC: New Warehouse Permission Codes

## Goal
Register all new warehouse sub-permissions in the permission catalog and grant them to appropriate system roles.

## Owner Role
`backend-dev`

## Depends On
`none` (parallel with T-001)

## Estimated Size
S

## Files Likely Touched
- `apps/api/app/modules/rbac/permissions.py` — `ALL_PERMISSIONS` list + `ROLE_GRANTS`

## Acceptance Criteria
- [ ] Following permission codes added to `ALL_PERMISSIONS`:
  - `warehouse.type.view`, `warehouse.type.manage`
  - `warehouse.rack.view`, `warehouse.rack.manage`
  - `warehouse.transfer.view`, `warehouse.transfer.send`, `warehouse.transfer.receive`, `warehouse.transfer.cancel`
  - `warehouse.request.view`, `warehouse.request.create`, `warehouse.request.approve`
  - `warehouse.product.import`, `warehouse.product.export`
- [ ] Grants in `ROLE_GRANTS` (or equivalent dict):
  - `admin`: all 13 codes above
  - `manager`: all except `warehouse.transfer.cancel`
  - `cashier`: `warehouse.request.create`, `warehouse.transfer.view`, `warehouse.request.view`
  - `viewer`: `*.view` and `warehouse.product.export`
  - `accountant`: `warehouse.product.export`, `warehouse.transfer.view`, `warehouse.request.view`
- [ ] Existing broad `warehouse.*` permissions untouched (no removals).
- [ ] `docker exec erp-api pytest apps/api/tests/ -v` — existing tests still pass.

## How We'll Know It's Done
A superadmin call to `GET /rbac/permissions` returns all 13 new codes. Manager role includes `warehouse.transfer.send` but not `warehouse.transfer.cancel`.
