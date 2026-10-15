# MA-1 — Architect design: API contract freeze + Flutter app skeleton

**Owner role**: architect
**Depends on**: none
**Reads before starting**: `tickets/SPEC-merchant-admin.md` (full, especially §3 module map,
§4 reconciliation with `SPEC-desktop-mobile-apps.md`, §9 risks), `tickets/SDLC.md`,
`CLAUDE.md`. Reference-only (different codebase, do not copy verbatim):
`D:\Docker\projects\pos\apps\merchant-admin\lib\**`, `D:\Docker\projects\pos\tickets\DESIGN-MA1.md`.

## Goal

Produce `tickets/DESIGN-merchant-admin.md`, status FROZEN, that (a) freezes the exact
ERP API contract (path, method, permission code, request/response shape) every mobile
screen will call, verified against the real routers — not assumed from SPEC's table — and
(b) specifies the `apps/merchant-admin` Flutter folder/file layout, navigation/route table,
and the permission-driven nav-gating mechanism, so `MA-2`..`MA-6` can build in parallel
without colliding on files or guessing endpoints.

## Files likely touched

- `tickets/DESIGN-merchant-admin.md` (new — this ticket's only deliverable)
- Read-only verification against: `apps/api/app/modules/mobile/router.py`,
  `apps/api/app/modules/statistics/router.py`, `apps/api/app/modules/hr/router.py`,
  `apps/api/app/modules/hr/payroll_router.py`, `apps/api/app/modules/finance/router.py`,
  `apps/api/app/modules/warehouse/router.py`, `apps/api/app/modules/rbac/router.py`,
  `apps/api/app/modules/rbac/permissions.py`, `apps/api/app/modules/rbac/middleware.py`
  (to resolve SPEC §3's flagged "`/warehouse/categories` permission code unconfirmed"),
  `apps/api/app/modules/sale/router.py` (to scope the read-only "orders" screen),
  `apps/api/app/modules/auth/router.py`.
- No code files are modified by this ticket — design only.

## Must resolve (not optional — these are explicitly unresolved in SPEC §3/§9)

1. The exact permission code enforced on `/warehouse/categories` CRUD (confirm via
   `rbac/middleware.py`'s auto-derive logic, don't assume).
2. Whether a `GET` "list my push devices" endpoint needs to be added in `MA-2` (POS's
   `GET /fcm/devices` has no ERP equivalent today).
3. Confirm — by grepping for any code path that reads `push_tokens` and calls an external
   push provider — whether a push-sending service exists at all. State the finding plainly
   in the design doc; don't leave it ambiguous for `MA-6`.
4. The frozen Flutter `lib/` file tree (one owning ticket per file, no two tickets writing
   the same file — mirror the POS `DESIGN-MA1.md` §3 "file-collision rule").
5. The frozen route table + which routes are hidden for `manager` vs `admin`, expressed as
   **permission-code conditions** (e.g. `perms.contains("hr.payroll.approve")`), never a
   role-name string comparison (SPEC §2, §6 MUST).
6. Android `applicationId` / package name proposal (SPEC open question #6) — propose one,
   flag for human confirmation, don't treat your proposal as final.

## How we'll know it's done

- `tickets/DESIGN-merchant-admin.md` exists, marked FROZEN, and every endpoint referenced
  by a later ticket (`MA-2`..`MA-6`) has a path+method+permission-code triple that was
  verified by reading the actual router file (cite file:line), not copied from
  `SPEC-merchant-admin.md`'s table unverified.
- The doc explicitly states yes/no on items 1-3 above, with evidence.
- The doc contains a file-ownership table (file path → ticket) with no duplicates.

## Owner role

architect

## Depends on

none
