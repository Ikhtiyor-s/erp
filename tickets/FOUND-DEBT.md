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

---

## 2026-10-14 — Architect (DESIGN-merchant-admin / MA-1 pass)

### DEBT-004: `apps/api/app/modules/mobile/router.py` has NO authorization gate on any endpoint, and several of its endpoints don't even check org membership (HIGH)

**Found in**: `apps/api/app/main.py:131` (`app.include_router(mobile_router, prefix=API_PREFIX)` — mounts with no extra path segment, so every route in this file lives directly under `/api/v1/`), `apps/api/app/modules/rbac/middleware.py:27-50` (`URL_MODULE` dict has no entry for any of this file's first path segments: `cashbox-sessions`, `push`, `open-tickets`, `tags`, `custom-fields`, `installments`, `distribution`, `visits`, `courier`, `delivery-orders`, `passcode`, `pos-pages`, `cashback`, `ocr`, `attachments`), and `apps/api/app/modules/mobile/router.py` (read in full for the cashbox-session and push endpoints, lines 406-588 and 1154-1183 — none has an explicit `Depends(require_permission(...))`).

Because `required_permission()` returns `None` for any path whose first segment isn't in `URL_MODULE`, `PermissionMiddleware` silently skips enforcement for the entire `mobile` module. Combined with the complete absence of any endpoint-level `require_permission` dependency in this file, **every endpoint in this module is reachable by any authenticated user regardless of role** — there is no permission check at all, anywhere in this file. Worse: several of these endpoints (e.g. `open_session`/`close_session`/`active_session`/`list_sessions` in the cashbox-sessions group) never verify that the calling `user_id` is actually a member of the `organization_id` sent in the `X-Organization-Id` header — they just trust the header and run the query. Endpoints gated by the normal middleware path get this membership check "for free" (a non-member has zero rows in `user_organizations`, hence zero permissions, hence a 403) — endpoints in this file get no such protection. **Concretely: a valid JWT for ANY organization can open/close cash register shifts, read till totals, register/unregister push tokens, and touch every other endpoint in this file (tags, custom-fields, installment plans, open-tickets, distribution/visits, courier tracking, delivery-orders, POS pages, cashback, OCR, attachments) for ANY `organization_id` supplied in the header, with zero authorization and zero membership check.**

This was found while writing `DESIGN-merchant-admin.md` (MA-1), which reuses `/cashbox-sessions/*` and `/push/*` for the new Flutter app per SPEC's explicit instruction not to reinvent till-shift logic — the finding is incidental to that read, not something MA-1 introduced. It also affects the existing mobile PWA (`apps/web/app/m/`), which already calls these same endpoints today, unaudited. **Risk: HIGH** — this is a live cross-tenant data-isolation gap on money-moving operations (cash register open/close, inkassatsiya), not a hypothetical. Recommend a dedicated backend security ticket (add `require_permission` to every mutating endpoint in this file at minimum, and add an explicit org-membership check to any endpoint whose only guard today is "is this a valid JWT" at all) — scoped and reviewed independently of `MA-2`'s narrow, additive gap-closing mandate.

### DEBT-005: `GET /statistics/export/{report}` derives the generic `statistics.view` permission even when `report=cogs`, never the more specific `statistics.cogs.export` (LOW)

**Found in**: `apps/api/app/modules/statistics/router.py:587` (`GET /export/{report}`) and `apps/api/app/modules/rbac/middleware.py:60-68,127-138` (`SUFFIX_ACTION`/`_action_from_path_method`).

The middleware's CR-2 fix ("export/import/report suffixes derive explicit permissions") only triggers when the **last path segment itself** is literally `export`/`import`/`report`/`reports` (or starts with `export-`/`import-`/`report-`). Here the last segment is the dynamic `{report}` value (e.g. `cogs`, `products`, `sale-by-category`), so `_action_from_path_method` falls through to the plain `METHOD_ACTION["GET"] = "view"`, and the derived permission is always `statistics.view` — never `statistics.cogs.export`, even when exporting the COGS report specifically. The `statistics.cogs.export` permission code exists in the catalog (`rbac/permissions.py:128`, granted to `admin`/`accountant`) but **no endpoint anywhere references it** — it is dead/unenforced. **Risk: LOW today** — every role currently granted `statistics.view` in practice (`admin`, `manager`, `accountant`, `viewer`) is also already granted `statistics.cogs.view`/`statistics.cogs.export` in `ROLE_GRANTS`, so there is no role that can reach `/statistics/view` but not COGS specifically, making this latent rather than actively exploitable right now. Worth fixing if a future role is ever given `statistics.view` without COGS visibility.
