# MA-2 — Backend gap-closing for merchant-admin (additive only, no new module)

**Owner role**: backend-dev
**Depends on**: MA-1 (do not start until `DESIGN-merchant-admin.md` is FROZEN and lists the
exact gaps this ticket must close — do not invent additional gaps unprompted)

## Goal

Close only the backend gaps `MA-1`'s `DESIGN-merchant-admin.md` explicitly identifies
(e.g. missing permission dependency on `/warehouse/categories`, a "list my push devices"
endpoint if confirmed needed) — extending existing modules, never creating a new one.

## Files likely touched

- `apps/api/app/modules/mobile/router.py` (only if DESIGN calls for a push-devices-list
  endpoint or similar additive mobile-specific endpoint)
- `apps/api/app/modules/warehouse/router.py` (only if DESIGN finds the categories
  permission gap real and needs an explicit `Depends(require_permission(...))`)
- `apps/api/app/modules/rbac/permissions.py` (only if a new permission code is required —
  must be added to `ALL_PERMISSIONS` and granted to `admin`/`manager` in `ROLE_GRANTS` per
  `CLAUDE.md` RBAC rule)
- `apps/api/tests/test_mobile.py` or `apps/api/tests/test_warehouse.py` (new/updated tests)
- `apps/api/app/db/schema_patches.py` (only if DESIGN requires a new column/table —
  idempotent `IF NOT EXISTS` SQL, per `CLAUDE.md`; unlikely for this ticket's scope)

## How we'll know it's done

- `docker exec erp-api pytest apps/api/tests/ -v` green, including a new test per changed/
  added endpoint.
- Every new or modified endpoint has an explicit permission dependency (either via
  `Depends(require_permission(...))` or a confirmed, cited auto-derive path) and a test
  proving cross-tenant isolation (org B cannot see org A's rows via the new/changed path).
- No new file under `apps/api/app/modules/` outside the existing module directories listed
  above — if `DESIGN-merchant-admin.md` asked for a new module, that's a DESIGN defect to
  escalate back to `architect`/`pm`, not something to build around silently.
- Changed files reported.

## Owner role

backend-dev

## Depends on

MA-1
