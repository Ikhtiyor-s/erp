# FOUND-DEBT.md — Technical debt discovered during design/review passes

> Append-only. Do NOT act on these items in the sprint where they were found.
> Each entry: date, finder, description, risk level (LOW/MED/HIGH).

---

## 2026-08-26 — Architect (DESIGN-2 pass)

### DEBT-001: `stock_balances` missing `organization_id` column (MED)

**Found in**: `infra/postgres/init.sql` lines 255-263.

`stock_balances` has `UNIQUE(warehouse_id, product_id)` but no `organization_id` column. Tenant isolation relies entirely on `warehouse_id` being org-scoped (warehouses have `organization_id`). This means a cross-org query against `stock_balances` filtered only by `warehouse_id` values that happen to collide could theoretically leak data. In current practice it is safe because `warehouse_id` is an auto-increment INT and each org only sees its own warehouse IDs via `WHERE warehouses.organization_id = :o`. However, this violates the project's explicit multi-tenant rule: "Har domain jadval `organization_id` ustuniga ega." Adding `organization_id` to `stock_balances` would require a data migration and changes to `_stock_apply` / `_stock_qty`. **Risk**: LOW in practice today; MED if multi-tenant isolation audits are run.

### DEBT-002: `sale_items.id` is `BIGSERIAL` (int), not UUID (LOW)

**Found in**: `infra/postgres/init.sql` line 417.

`order_pick_items.item_id` in SPEC-2 / T-020 is specified as UUID. The actual `sale_items.id` is `BIGSERIAL PRIMARY KEY` (integer). Backend-dev must use `BIGINT` for `item_id`, not UUID. DESIGN-2 documents this risk explicitly; T-020 acceptance criteria also flags it. No migration is needed — it just affects the column type chosen during T-020.

### DEBT-003: `GET /warehouse/products` lacks `COUNT(*)` for total (LOW)

**Found in**: `apps/api/app/modules/warehouse/router.py` lines 206-247.

The existing endpoint has no `total` field in its response — it returns a raw list. The new T-026 paginated variant must add a separate `SELECT COUNT(*) ... WHERE ...` (same filters, no LIMIT/OFFSET) or a window function. This is not debt per se but the existing endpoint shape is inconsistent with the new paginated shape. Existing callers expect a JSON array, not an object with `items`. The dual-mode design in Section 5.4 handles this via `warehouse_id` presence detection.
