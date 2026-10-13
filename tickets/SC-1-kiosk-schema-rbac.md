# SC-1 — Kiosk Devices: DB Schema + RBAC Permission Codes

**Owner Role**: backend-dev
**Depends On**: none
**Blocks**: SC-2 (device-auth dependency + admin endpoints need the table and the permission
codes to exist)
**Estimated Size**: S (< 1 kun)
**Priority**: P1
**Spec/Design Reference**: `tickets/DESIGN-self-checkout-auth.md` ("DB o'zgarishlari", "RBAC"
sections) — this ticket implements that frozen contract verbatim, no new decisions to make.

---

## Goal

Create the `kiosk_devices` table and register the four `kiosk.*` permission codes
(`kiosk.view`, `kiosk.create`, `kiosk.update`, `kiosk.delete`) — the foundation every other
kiosk ticket builds on. No endpoints, no auth logic — pure schema + permission catalog.

---

## Rationale

The architect's DESIGN explicitly rejected extending the existing `devices` table (printer/
scanner/scale metadata, no secret material, broad `warehouse.*`/`finance.*` write access today)
in favor of a new, narrow-scope `kiosk_devices` table — because a kiosk token is a bearer
credential that moves real stock, not cosmetic equipment metadata. Mirrors this repo's own
`T-001-schema-migration.md` / `T-002-rbac-permissions.md` split: schema and permission-catalog
changes are independent, zero-dependency, and should land before anything consumes them.

---

## Files Likely Touched

- `apps/api/app/db/schema_patches.py` — `CREATE TABLE IF NOT EXISTS kiosk_devices (...)` (exact
  DDL already frozen in DESIGN doc, copy verbatim) + its 3 indexes
  (`uq_kiosk_devices_token_hash`, `idx_kiosk_devices_org_status`, `idx_kiosk_devices_cashbox`)
- `apps/api/app/modules/rbac/permissions.py` — add `kiosk.view`, `kiosk.create`,
  `kiosk.update`, `kiosk.delete` to `ALL_PERMISSIONS`; grant all four to `admin` only in
  `ROLE_GRANTS`
- `apps/api/tests/test_kiosk_devices_schema.py` — new

---

## Acceptance Criteria

### DB Schema
- [ ] `kiosk_devices` table created exactly per DESIGN DDL: `id UUID PK`, `organization_id`,
  `cashbox_id` (FK `cashboxes.id`, `ON DELETE RESTRICT` — deleting a cashbox with a live kiosk
  must fail, not silently orphan the device), `name`, `token_hash VARCHAR(64)`,
  `token_prefix VARCHAR(10)`, `status VARCHAR(20) DEFAULT 'active'`, `last_used_at`,
  `last_used_ip`, `created_by`, `created_at`, `revoked_at`, `revoked_by`
- [ ] **No `warehouse_id` column** — per DESIGN, warehouse is always derived from
  `cashboxes.warehouse_id` at request time (same pattern as T-206 "Case 3"). Do not add it even
  if it looks convenient — this was an explicit architect decision, not an oversight.
- [ ] `CREATE TABLE IF NOT EXISTS` — additive only, no changes to any existing table
- [ ] Unique index on `token_hash`, plus the two secondary indexes listed above

### RBAC
- [ ] `kiosk.view`, `kiosk.create`, `kiosk.update`, `kiosk.delete` added to `ALL_PERMISSIONS`
- [ ] **MUST NOT** be auto-granted to `manager`, `cashier`, `accountant`, or `viewer` in
  `ROLE_GRANTS` — `admin` only. This is intentional per DESIGN ("bu feature'ning o'zi 'avtomatik
  qabul qilinmaydi' tamoyili bilan yaratilgani kabi") — owner can hand-grant to `manager` later
  via the existing role-edit UI if they choose, but the seed must not decide that for them.
- [ ] `GET /rbac/permissions` response includes all 4 new codes

### Tests
- [ ] `test_kiosk_devices_schema.py`: table + all 3 indexes exist after migration
- [ ] `test_kiosk_devices_schema.py`: deleting a cashbox referenced by a `kiosk_devices` row
  raises (FK `RESTRICT`), does not cascade-delete the kiosk device
- [ ] Existing `test_rbac_permissions.py` (or equivalent) still passes; `admin` has all 4 new
  codes, `manager`/`cashier`/`accountant`/`viewer` have none of them

---

## Technical Notes

- Copy the DDL from `DESIGN-self-checkout-auth.md` verbatim — it is marked FREEZE. Do not
  "improve" column names or types while implementing.
- `cashbox_id` type must match whatever `cashboxes.id` actually is in this DB (check
  `schema_patches.py` — likely `INT`, confirm before writing the FK, same caution T-206 flags).
- This ticket does **not** create `kiosk_orders` — that table belongs to SC-3 (checkout flow),
  per the SPEC's own note that `kiosk_orders` "is part of the checkout flow, not the token
  model."

---

## Definition of Done

- [ ] Mechanical: `pytest apps/api/tests/test_kiosk_devices_schema.py -v` — 0 fail
- [ ] Mechanical: `psql -c "\d kiosk_devices"` — matches DESIGN DDL exactly
- [ ] Mechanical: `psql -c "\d cashboxes"` unaffected (no columns added to existing tables)
- [ ] Agentic: qa-reviewer BLOCKER yo'q
- [ ] Human-gate: merge
