# DESIGN — Merchant Admin (Flutter, `apps/merchant-admin`)

**Status:** FROZEN — API contract (§6) and file tree (§4) are the freeze line. `MA-2`
(backend-dev) and `MA-3`..`MA-6` (frontend-dev, dispatched under the `flutter-dev` label
per SPEC §9 OQ2) build in parallel against this document, not against `SPEC-merchant-admin.md`'s
table, which was PM-level reconnaissance and is superseded here wherever the two disagree.
**Author:** architect
**Date:** 2026-10-14
**Depends on:** `tickets/SPEC-merchant-admin.md`, `tickets/SDLC.md`, `CLAUDE.md`
**Reference (ported pattern, not ported contract):** `D:\Docker\projects\pos\apps\merchant-admin\lib\**`,
`D:\Docker\projects\pos\tickets\DESIGN-MA1.md`

Every endpoint in §6 was read directly from the router file cited (file:line). Every
permission code was cross-checked against `ROLE_GRANTS` in `apps/api/app/modules/rbac/permissions.py`
and against the auto-derive logic in `apps/api/app/modules/rbac/middleware.py`. Nothing here
is copied from SPEC's table unverified.

---

## 0. Must-resolve items — definitive answers

| # | Question | Answer |
|---|---|---|
| 1 | Exact permission on `/warehouse/categories` CRUD | **No explicit `require_permission` dependency exists on any of the four endpoints** (`warehouse/router.py:126,138,152,168`). They are gated **only** by `PermissionMiddleware`'s auto-derive: path `/api/v1/warehouse/categories` → module `warehouse` (`URL_MODULE["warehouse"]`) → action from HTTP method → `warehouse.view` (GET) / `warehouse.create` (POST) / `warehouse.update` (PUT) / `warehouse.delete` (DELETE). **Consequence: `manager` can view/create/update categories but CANNOT delete them** (`ROLE_GRANTS["manager"]` has no `warehouse.delete`; only `admin` has it via `ALL_PERMISSIONS`). See §6.3. |
| 2 | Does MA-2 need to add a "list my push devices" endpoint? | **Yes, SHOULD add one** — `GET /push/devices`, trivial additive SELECT on the existing `push_tokens` table, same auth level as the existing `POST /push/register`/`DELETE /push/{token}` (no explicit permission, `authenticate`-only). Contract frozen in §6.8. |
| 3 | Does a push-sending service exist anywhere? | **No. Confirmed by repo-wide grep.** `grep -r "firebase\|fcm\|push_tokens"` across `apps/api` returns exactly two files: `modules/mobile/router.py` (register/unregister/the-new-list endpoint) and `db/schema_patches.py` (the `push_tokens` table DDL). Zero `firebase-admin` package usage, zero service-account file, zero sender code, zero `apps/api` reference to Firebase/APNs anywhere. **Unlike the POS sister-app, ERP does not even have a placeholder `google-services.json` anywhere in the repo** — this is a clean-slate "integration point exists, sender does not" situation. See §7. |
| 4 | Frozen `lib/` file tree, one ticket per file | §4. |
| 5 | Route table + permission-code gating (no role-name comparison) | §5, §6. |
| 6 | Android `applicationId` proposal | `uz.aniqerp.merchantadmin` (package `uz.aniqerp.merchantadmin`, Flutter `pubspec` name `merchant_admin`, display name **"Aniq ERP Admin"**) — **proposal only, needs human confirmation** (SPEC §13 OQ6). No existing `uz.*` Flutter convention in this repo to conflict with (ERP has zero prior Flutter code). |

---

## 1. Corrections to `SPEC-merchant-admin.md` and to naive 1:1 porting of the POS pattern

These are things that would have been silently wrong if ported mechanically. Each is backed
by a direct code read, not inference.

### 1.1 Dashboard is NOT role-restricted in ERP (POS's reference pattern does not apply)

POS's `DESIGN-MA1.md` §4/§8 hides the Dashboard tab for `MANAGER` because POS's
`dashboard.routes.ts` literally 403s that role. **ERP has no such restriction.**
`GET /statistics/dashboard` (`statistics/router.py:22`) has no endpoint-level
`require_permission` at all — it is gated purely by the middleware's auto-derive to
`statistics.view`, which **both `admin` and `manager` hold** (`ROLE_GRANTS["manager"]`
includes `"statistics.view"`). **Do not port the "swap Dashboard for Statistics-overview
as manager's home route" logic** — in ERP, `admin` and `manager` see an identical
Dashboard tab. This also means Dashboard and Statistics are gated by the exact same
permission code (`statistics.view`) in ERP — there is no world (short of a custom role
splitting the two, which the backend does not support since both map to the same code)
where one is visible and the other isn't.

### 1.2 No realtime/socket layer exists anywhere in ERP's backend

POS's app ports `socket_service.dart` (socket.io-client) for live order push. **ERP has no
WebSocket or socket.io infrastructure at all** — confirmed by grepping `apps/api/app` for
`websocket|socket\.io|WebSocket`; the only hit is a `# TODO: upgrade to WebSocket push when
admin progress dashboard moves to real-time` comment in `warehouse/pick_router.py:273`, an
unrelated future feature. **`socket_service.dart` is dropped entirely from this app's file
tree** (§4) — no `socket_io_client` dependency, no live-push anywhere. Every data screen
(Dashboard, Orders, Statistics) **MUST** implement pull-to-refresh (`RefreshIndicator`) and
re-fetch on screen resume (`didPopNext`/route re-entry) as the only "freshness" mechanism.
This also removes POS's `AuthState.login()`/`logout()` socket `.connect()`/`.disconnect()`
calls — `auth_state.dart` in this app has no socket lifecycle to own.

### 1.3 `custom_reports_screen.dart` (named in PM's `MA-4` ticket) has no real backend equivalent — repurposed

POS's reference has a true custom/ad-hoc report builder (`/reports-advanced/custom`,
user-defined report shape). **ERP has no such endpoint.** PM's `MA-4` ticket text lists a
file named `custom_reports_screen.dart` seemingly ported from the POS file list without
checking it maps to a real ERP capability — exactly the "almost got designed in by taking
ticket text at face value" trap this role exists to catch. **Resolution: keep the filename
(no ticket-text mismatch for MA-4), but redefine its contents** — it becomes "Qo'shimcha
hisobotlar" (additional canned reports): `sale-by-customer`, `unsold-goods`,
`customer-activity`, each with a CSV export button via `GET /statistics/export/{report}`.
It is a **list of fixed, pre-built reports**, not a report builder. No "create a custom
report" form exists or is built.

### 1.4 No product image upload endpoint exists — mobile product form is URL-field-only

POS's Node backend has `POST /products/:id/image` (multipart). **ERP has no equivalent.**
`warehouse/router.py`'s only `UploadFile` usage is the `.xlsx` bulk-import endpoint,
unrelated to product photos. `ProductIn.image_url` (`warehouse/router.py:202`) is a plain
`str | null` — the product *already has* a photo field, but setting it requires a URL, not
a camera/file upload widget. **`product_detail_screen.dart` (MA-5) ships an optional
plain-text "rasm URL" field, not a camera/upload widget.** Adding real mobile photo capture
would require a new backend file-storage endpoint — explicitly out of scope here (§9); if
wanted, it is a new ticket, not a v1 stretch goal.

### 1.5 Product removal has two different, non-interchangeable backend operations — mobile uses only one

`DELETE /warehouse/products/{pid}` (`warehouse/router.py:468`) sets `is_active = FALSE` and
is gated by the middleware-derived `warehouse.delete` (**admin-only** — `manager` lacks
`warehouse.delete`). `POST /warehouse/products/{pid}/archive` (`warehouse/router.py:510`,
explicit `require_permission("warehouse.product.archive")`) sets `is_archived = TRUE` and
**is reversible** via `.../unarchive` (`warehouse/router.py:580`) — and `manager` **does**
hold `warehouse.product.archive`. Shipping both as two different "remove" buttons in one
screen would be confusing and would make the hard-delete path effectively admin-only while
archive is the one both roles can actually use. **Decision: the mobile Catalog screen's
"remove product" action calls archive/unarchive only. The hard `DELETE /products/{pid}`
endpoint is never called by this app.** Category removal has no archive concept in the
schema (`product_categories` has no `is_archived` column) — category delete therefore has
no substitute and stays on the hard `DELETE /categories/{cid}` path, which is consequently
**admin-only** in this app (§6.3).

### 1.6 Security finding (pre-existing, NOT created by this design, out of scope to fix in `MA-*`): the `mobile` module has no authorization gate at all

`app.include_router(mobile_router, prefix=API_PREFIX)` (`main.py:131`) mounts
`modules/mobile/router.py` with **no extra path segment** — its routes live directly under
`/api/v1/` (e.g. `/api/v1/cashbox-sessions/open`, `/api/v1/push/register`,
`/api/v1/open-tickets`, `/api/v1/tags`, etc. — confirmed via the router's own
`APIRouter(tags=["mobile"])` declaration with no `prefix=` kwarg, `mobile/router.py:30`).
`PermissionMiddleware`'s `URL_MODULE` dict (`rbac/middleware.py:27-50`) has **no entry**
for any of this module's first path segments (`cashbox-sessions`, `push`, `open-tickets`,
`tags`, `custom-fields`, `installments`, `distribution`, `visits`, `courier`,
`delivery-orders`, `passcode`, `pos-pages`, `cashback`, `ocr`, `attachments`) — so
`required_permission()` returns `None` for every one of them and the middleware **skips
enforcement entirely**. I read every cashbox-session and push endpoint's body directly
(`mobile/router.py:406-588`, `1154-1183`): **none of them has an explicit
`Depends(require_permission(...))` either**, and none of them checks that the calling
`user_id` is even a member of the `org_id` sent in the `X-Organization-Id` header (contrast
with endpoints gated by middleware, where `get_user_permissions` implicitly enforces
membership because a non-member has zero rows in `user_organizations` and thus zero
permissions). **Net effect: any authenticated user — regardless of role, regardless of
whether they belong to the target organization at all — can open/close cash shifts,
register/unregister push tokens, and touch every other endpoint in this file for ANY
`organization_id` they choose to send in the header.** This is not something `MA-1`/`MA-2`
introduces (the gap predates this ticket) and per SPEC §6 MUST-NOT and this ticket's scope
I am **not** redesigning the `mobile` module here. For this app's purposes: Till-shift
screens (MA-6) work for `admin`/`manager` with zero permission friction (there is no gate
to fail), but the client-side gating I specify in §6.6 for the Till-shift nav tile
(`finance.view`) is **cosmetic only** — it does not reflect a real server-side check.
**Logged to `tickets/FOUND-DEBT.md` as DEBT-004/DEBT-005 (below) and flagged in §10 for
human/PM escalation** — this is a cross-tenant data-isolation gap that should get its own
backend security ticket, independent of and not blocking `MA-*`.

### 1.7 `manager` lacks `*.delete` uniformly — a general rule, not six separate special cases

Across every module this app touches, `admin` = `ALL_PERMISSIONS` and `manager`'s grant
list (`rbac/permissions.py:177-219`) includes `<module>.create`/`<module>.update` but
**never** `<module>.delete`, for `warehouse`, `hr`, and `finance`. Since the
`PermissionMiddleware` derives `DELETE → <module>.delete` automatically for every endpoint
that has no more specific override, this one rule explains every hard-delete gating
decision in §6 without needing a bespoke justification per screen: category delete,
position delete, employee "fire" (delete), expense delete, and draft-payroll-run delete are
**all admin-only**, uniformly, because they are all plain `DELETE` verbs on modules where
`manager` was never granted the `.delete` suffix. `accountant` (out of scope for this app,
§2 of SPEC) follows the same pattern and also lacks all three `.delete` codes.

---

## 2. Stack

| Layer | Choice | Why |
|---|---|---|
| Language/runtime | Flutter (stable channel; run `flutter --version` at scaffold time and pin whatever resolves — no decision here depends on a specific patch version) | SPEC decision, first Flutter app in this repo, nothing to match |
| State management | **Provider** (`ChangeNotifier`) | Matches the pattern proven in the POS sister-app; ERP has zero existing Flutter code so there is no in-repo convention to match instead, and Provider is simpler than Riverpod for this app's actual complexity (no deeply nested derived state) |
| Routing | **go_router**, `MaterialApp.router` + one `ShellRoute` for the 5 bottom-nav roots | Same as POS reference — proven pattern, no reason to deviate |
| HTTP | **Dio**, single `ApiClient.instance` singleton, `Authorization: Bearer` + `X-Organization-Id` header interceptor, 401 → `/auth/refresh` → retry-once | Ported from POS; ERP's own `apps/web/lib/api.ts` (axios) already does the equivalent two-header pattern server-side expectation, so this is consistent with the existing (non-Flutter) client too |
| Secure storage | **flutter_secure_storage** for `access_token`/`refresh_token` | CLAUDE.md §8-equivalent mobile security baseline (same rule the POS sister-app's `FOUND-DEBT` entry exists to enforce — do not regress to `SharedPreferences` for tokens) |
| Non-sensitive local prefs | `shared_preferences` for: selected `organization_id`, selected `warehouse_id`, selected `cashbox_id`, push-preference toggle, `local_cache` TTL blobs | Not secrets, no need for secure storage overhead |
| Realtime | **None** — no socket.io, no WebSocket (§1.2) | ERP has no backend realtime layer to connect to |
| Push | `firebase_core` + `firebase_messaging`, registration-only client (§7) | SPEC explicit MAY; no sender exists, so no foreground/background/tap-routing handling is built (§7) |
| Charts | Any single lightweight chart package for the revenue sparkline/bar (e.g. `fl_chart`) — MA-4's choice, not architecturally significant | Matches POS's `revenue_chart.dart` role, no need to standardize further |
| i18n | **None for v1 — single locale (Uzbek)** | Out of scope; see §9. ERP backend error strings are already Uzbek-only in the modules this app calls, so a single-locale UI is consistent, not a regression |

---

## 3. Package / branding

| | Value |
|---|---|
| App path | `apps/merchant-admin` |
| Flutter `pubspec` `name` | `merchant_admin` |
| Android `applicationId` | `uz.aniqerp.merchantadmin` — **proposal, needs human confirmation** (§0 item 6) |
| iOS | **Not built** (SPEC §7 explicit WON'T DO — Android-only v1) |
| Display name (`android:label`) | "Aniq ERP Admin" — proposal, same confirmation caveat |
| Flutter SDK constraint | Whatever `flutter --version` resolves to at `MA-3` scaffold time, pinned in `pubspec.yaml` |

---

## 4. File/folder layout (FROZEN) — one ticket owns each file, no duplicates

```
apps/merchant-admin/
├── pubspec.yaml                                         MA-3
├── analysis_options.yaml                                MA-3
├── android/ (flutter create scaffold, applicationId per §3)   MA-3
│   └── app/google-services.json  (placeholder — §7)      MA-3
├── lib/
│   ├── main.dart                                         MA-3
│   ├── config.dart                                       MA-3
│   ├── router.dart  (full route table, §5; placeholder   MA-3
│   │   screens for MA-4/5/6 areas until those tickets land)
│   ├── state/
│   │   └── auth_state.dart                               MA-3
│   ├── services/
│   │   ├── api_client.dart                               MA-3
│   │   ├── auth_service.dart                             MA-3
│   │   ├── storage.dart                                  MA-3
│   │   ├── permissions_service.dart  (wraps              MA-3
│   │   │   GET /rbac/me/permissions; hasPermission(code),
│   │   │   role, isSuperadmin — §6.1. READ by every other
│   │   │   ticket, WRITTEN only here)
│   │   ├── org_service.dart  (GET /organizations/mine +   MA-3
│   │   │   local active-org selection/persistence — §6.1)
│   │   ├── fcm_service.dart  (registration-only — §7)      MA-3
│   │   ├── connectivity.dart  (online/offline               MA-3
│   │   │   ChangeNotifier singleton)
│   │   ├── local_cache.dart  (SharedPreferences TTL          MA-3
│   │   │   read-cache — §8 offline posture. READ by
│   │   │   MA-4/MA-6, WRITTEN only here)
│   │   ├── dashboard_service.dart                           MA-4
│   │   ├── statistics_service.dart                          MA-4
│   │   ├── menu_service.dart                                MA-5
│   │   ├── orders_service.dart  (read-only)                 MA-6
│   │   ├── till_shift_service.dart                          MA-6
│   │   ├── staff_service.dart                               MA-6
│   │   ├── expenses_service.dart                            MA-6
│   │   └── settings_service.dart                            MA-6
│   ├── screens/
│   │   ├── login_screen.dart                                MA-3
│   │   ├── more_screen.dart  (nav hub — MOVED to MA-3,       MA-3
│   │   │   see §4.1 correction)
│   │   ├── dashboard_screen.dart                             MA-4
│   │   ├── statistics/
│   │   │   ├── statistics_overview_screen.dart               MA-4
│   │   │   ├── sales_history_screen.dart                     MA-4
│   │   │   └── custom_reports_screen.dart (repurposed, §1.3) MA-4
│   │   ├── menu/
│   │   │   ├── product_list_screen.dart                      MA-5
│   │   │   ├── product_detail_screen.dart                    MA-5
│   │   │   ├── category_list_screen.dart                     MA-5
│   │   │   └── category_edit_screen.dart                     MA-5
│   │   ├── orders_screen.dart                                MA-6
│   │   ├── till_shift_screen.dart                             MA-6
│   │   ├── scanner_screen.dart (barcode lookup only — §4.2)   MA-6
│   │   ├── staff_screen.dart (employees+attendance+payroll)   MA-6
│   │   ├── expenses_screen.dart                                MA-6
│   │   └── settings_screen.dart                                MA-6
│   ├── widgets/
│   │   ├── app_shell.dart (bottom nav, permission-driven)      MA-3
│   │   ├── permission_gate.dart (reusable                     MA-3
│   │   │   `PermissionGate(code:, child:)` widget — READ by
│   │   │   every screen ticket, WRITTEN only here)
│   │   └── revenue_chart.dart                                  MA-4
│   └── utils/
│       └── num_parse.dart (defensive Decimal-as-string-or-     MA-3
│           number parser — §8.3. READ by all)
└── test/
    └── widget_test.dart                                        MA-3
```

### 4.1 Correction to PM's `MA-6` ticket: `more_screen.dart` ownership moves to `MA-3`

PM's `MA-6-orders-tillshift-staff-expenses-settings.md` lists `more_screen.dart` in its
file list. **This is reassigned to `MA-3`** (the shell ticket), matching the POS precedent
(`DESIGN-MA1.md` §3: "part of shell, not a feature ticket, to avoid two frontend-devs
colliding on one hub file"). `more_screen.dart` is a static tile list of route-pushes
(`/staff`, `/expenses`, `/settings`, `/till-shift`) plus a logout button — it needs no
service calls of its own and can be written against the placeholder routes `MA-3` already
declares in `router.dart` before `MA-6`'s actual screens exist. Leaving it with `MA-6`
would force `MA-3` (which other parallel tickets depend on) to either stub it badly or wait
on `MA-6`, defeating the parallelization SPEC §15 asks for.

### 4.2 File-collision rule for `scanner_screen.dart` (MA-6) vs `menu_service.dart` (MA-5)

`MA-5` and `MA-6` run **in parallel** (both depend only on `MA-1`+`MA-3`, per SPEC §15's
schedule). `scanner_screen.dart` (MA-6) needs `GET /warehouse/barcode-lookup` — the same
module `menu_service.dart` (MA-5) lives in — but **MUST NOT** import or depend on
`menu_service.dart`, because there is no ordering guarantee between the two tickets.
`scanner_screen.dart` calls `ApiClient.instance.get('/warehouse/barcode-lookup', ...)`
**directly**, duplicating one HTTP call rather than creating a cross-ticket file
dependency. This mirrors the single-shared-file carve-outs in the POS precedent
(`revenue_chart.dart`, `dashboard_service.dart`'s model) — the fix here is simpler: don't
share the file at all, since the call is one line.

---

## 5. Navigation (FROZEN route table)

**Shell:** `MaterialApp.router` + `go_router`, one `ShellRoute` wrapping the 5 bottom-nav
roots.

**Bottom navigation — 5 tabs, identical for every role that can open the app at all** (§1.1 —
unlike POS, no tab swaps per role in ERP, because `statistics.view` governs both Dashboard
and Statistics uniformly):

| Tab | Icon | Root route | Owner | Visible iff |
|---|---|---|---|---|
| Dashboard | `home_outlined` | `/dashboard` | MA-4 | `perms.contains("statistics.view")` |
| Orders | `receipt_long_outlined` | `/orders` | MA-6 | `perms.contains("sale.view")` |
| Catalog | `inventory_2_outlined` | `/menu/products` | MA-5 | `perms.contains("warehouse.view") && perms.contains("warehouse.product.view")` |
| Statistics | `bar_chart_outlined` | `/statistics/overview` | MA-4 | `perms.contains("statistics.view")` |
| More | `more_horiz` | `/more` | MA-3 | always (authenticated) |

**Empty-state fallback (new requirement, not in POS reference):** if **none** of the four
base permissions above is present (possible for a hypothetical custom role with none of
`statistics.view`/`sale.view`/`warehouse.view` — SPEC §2 says this app targets
`admin`/`manager` only, but nothing server-side blocks a different role's user from
installing and logging into the APK), `app_shell.dart` shows a centered message
("Sizda bu ilovadan foydalanish uchun ruxsatlar yo'q — administratorga murojaat qiling")
instead of a nav bar with zero working tabs. This keeps the gating **permission-driven**
(SPEC §2/§6 MUST) rather than hard-blocking specific role codes at login.

**Full route table:**

```
/                           splash/redirect                     MA-3
/login                      LoginScreen                         MA-3
/dashboard                  DashboardScreen                     MA-4
/orders                     OrdersScreen                        MA-6
/orders/:id                 (detail — inline in OrdersScreen,    MA-6
                              or a push route; MA-6's call)
/till-shift                 TillShiftScreen                     MA-6
/scanner                    ScannerScreen                        MA-6
/menu/products               ProductListScreen                   MA-5
/menu/products/:id           ProductDetailScreen                 MA-5
/menu/categories             CategoryListScreen                  MA-5
/menu/categories/:id         CategoryEditScreen                  MA-5
/statistics/overview         StatisticsOverviewScreen            MA-4
/statistics/sales-history     SalesHistoryScreen                 MA-4
/statistics/custom-reports    CustomReportsScreen (repurposed)   MA-4
/more                         MoreScreen (hub)                   MA-3
/staff                        StaffScreen                        MA-6
/expenses                     ExpensesScreen                     MA-6
/settings                     SettingsScreen                     MA-6
```

Note what is **absent** on purpose versus the POS route table: no `/menu/modifier-groups`
(§1 SPEC — no ERP equivalent), no `/statistics/branch-compare` (no ERP branch concept),
no `/printer` (no Bluetooth printer integration in scope).

**Redirect logic (`router.dart`, MA-3):**
- Not authenticated + not on `/login` → redirect to `/login`.
- Authenticated + on `/login` or `/` → redirect to `/dashboard` **unconditionally** (no
  per-role branching — §1.1).
- No per-tab redirect-away logic is needed (unlike POS's manager→statistics redirect),
  because every tab's visibility condition (table above) already matches its access
  reality 1:1.

---

## 6. RBAC / permission contract

### 6.1 Source of truth and bootstrap sequence

1. `POST /auth/login` `{phone, password, twofa_code?}` → `TokenPair`. **No `X-Organization-Id`
   needed for this call** (`auth/router.py:252`, under `SKIP_PATHS_PREFIX "/api/v1/auth/"`).
   If the backend responds `401` with detail `"2FA code required"` (`auth/router.py:273`),
   the login screen shows a second field and resubmits with `twofa_code` — this app supports
   2FA-enabled accounts, it does not assume 2FA is off.
2. `GET /organizations/mine` (`organization/router.py:13`) → `[{id, name, code, is_default}]`.
   **No `X-Organization-Id` header required for this call either** (only
   `get_current_user_id` is a dependency) — this is deliberately the bootstrap call used
   *before* an org is chosen. If the list has exactly one entry, auto-select it. If more
   than one, and no `is_default: true` row disambiguates it alone, prompt a one-time org
   picker (stored locally, not re-asked every login unless the user explicitly changes it
   from Settings). Persist the chosen `organization_id` in `shared_preferences` (not a
   secret — org IDs are not sensitive) and set it as the `X-Organization-Id` header on
   every subsequent request for the life of the session.
3. `GET /rbac/me/permissions` (`rbac/router.py:27`) — **requires** `X-Organization-Id`
   (unlike step 2) → `{role: {code, name}, permissions: [...], is_superadmin: bool}`.
   `permissions_service.dart` caches this `permissions` list in memory for the session and
   exposes `bool hasPermission(String code) => _permissions.contains(code) || _isSuperadmin`.
   **Every nav/button gate in this app calls `hasPermission(code)` — never
   `user.role == "..."` or `user.role.code == "..."`** (SPEC §2/§6 MUST, Scenario 1).
4. Re-fetch step 3 on every app resume from background and after any role/permission-affecting
   action (there is none initiated from this app, but re-fetching on resume is cheap and
   defends against an admin changing the user's role from the web admin mid-session).

### 6.2 Headers on every authenticated request (MUST, SPEC §6/§8)

```
Authorization: Bearer <access_token>
X-Organization-Id: <selected organization id>
```
`api_client.dart`'s `onRequest` interceptor sets both unconditionally once
`AuthState.isAuthenticated` is true. `/auth/*` and the two bootstrap calls above are the
only exceptions (and the second of those two still needs the org header for calls *after*
org selection, just not for the `GET /organizations/mine` call itself).

### 6.3 Full endpoint × permission table (every endpoint this app calls)

"Derived" = `PermissionMiddleware` auto-derive only, no endpoint-level dependency.
"Explicit" = `Depends(require_permission(...))` on the endpoint itself (middleware's
generic derive for that same path/method still also applies and must independently pass —
both checks run; whichever is stricter determines the actual gate for `manager`).

| Endpoint | Perm required | admin | manager | Source |
|---|---|---|---|---|
| `GET /statistics/dashboard` | derived `statistics.view` | yes | yes | `statistics/router.py:22` |
| `GET /statistics/daily-revenue` | derived `statistics.view` | yes | yes | `statistics/router.py:71` |
| `GET /statistics/sales-summary` | derived `statistics.view` | yes | yes | `statistics/router.py:99` |
| `GET /statistics/sale-by-category` | derived `statistics.view` | yes | yes | `statistics/router.py:250` |
| `GET /statistics/sale-by-employee` | derived `statistics.view` | yes | yes | `statistics/router.py:277` |
| `GET /statistics/sale-by-customer` | derived `statistics.view` | yes | yes | `statistics/router.py:301` |
| `GET /statistics/sale-by-payment-type` | derived `statistics.view` | yes | yes | `statistics/router.py:326` |
| `GET /statistics/unsold-goods` | derived `statistics.view` | yes | yes | `statistics/router.py:179` |
| `GET /statistics/cogs` | **explicit** `statistics.cogs.view` | yes | yes (today — recheck per §1 note) | `statistics/router.py:433` |
| `GET /statistics/export/{report}` | derived `statistics.view` (NOT `statistics.cogs.export`, even when `report=cogs` — FOUND-DEBT, §10) | yes | yes | `statistics/router.py:587` |
| `GET /warehouse/categories` | derived `warehouse.view` | yes | yes | `warehouse/router.py:126` |
| `POST /warehouse/categories` | derived `warehouse.create` | yes | yes | `warehouse/router.py:138` |
| `PUT /warehouse/categories/{cid}` | derived `warehouse.update` | yes | yes | `warehouse/router.py:152` |
| `DELETE /warehouse/categories/{cid}` | derived `warehouse.delete` | yes | **no** | `warehouse/router.py:168` |
| `GET /warehouse/warehouses` | explicit `warehouse.warehouse.view` | yes | yes | `warehouse/router.py:45` |
| `GET /warehouse/products?warehouse_id=` | explicit `warehouse.product.view` **+** derived `warehouse.view` | yes | yes | `warehouse/router.py:224` |
| `GET /warehouse/products/{pid}/full` | derived `warehouse.view` | yes | yes | `warehouse/router.py:424` |
| `POST /warehouse/products` | derived `warehouse.create` | yes | yes | `warehouse/router.py:379` |
| `PUT /warehouse/products/{pid}` | derived `warehouse.update` | yes | yes | `warehouse/router.py:404` |
| `POST /warehouse/products/{pid}/archive` | explicit `warehouse.product.archive` | yes | yes | `warehouse/router.py:510` |
| `POST /warehouse/products/{pid}/unarchive` | explicit `warehouse.product.archive` | yes | yes | `warehouse/router.py:580` |
| `GET /warehouse/barcode-lookup?q=` | explicit `warehouse.product.barcode_view` | yes | yes | `warehouse/router.py:3563` |
| `GET /sale/sales` | derived `sale.view` | yes | yes | `sale/router.py:73` |
| `GET /sale/sales/{sale_id}` | derived `sale.view` | yes | yes | `sale/router.py:263` |
| `GET /hr/positions` | derived `hr.view` | yes | yes | `hr/router.py:26` |
| `POST /hr/positions` | derived `hr.create` | yes | yes | `hr/router.py:40` |
| `PUT /hr/positions/{pid}` | derived `hr.update` | yes | yes | `hr/router.py:54` |
| `DELETE /hr/positions/{pid}` | derived `hr.delete` | yes | **no** | `hr/router.py:70` |
| `GET /hr/employees`, `/{eid}` | derived `hr.view` | yes | yes | `hr/router.py:98,185` |
| `POST /hr/employees` | derived `hr.create` | yes | yes | `hr/router.py:134` |
| `PUT /hr/employees/{eid}` | derived `hr.update` | yes | yes | `hr/router.py:152` |
| `DELETE /hr/employees/{eid}` (fire) | derived `hr.delete` | yes | **no** | `hr/router.py:171` |
| `GET /hr/shifts` | derived `hr.view` | yes | yes | `hr/router.py:338` |
| `POST/DELETE /hr/shifts` | explicit `hr.shifts.manage` | yes | yes | `hr/router.py:368,403` |
| `POST /hr/attendance/clock-in|out` | derived `hr.create` | yes | yes | `hr/router.py:437,484` |
| `GET /hr/attendance` | explicit `hr.attendance.view` | yes | yes | `hr/router.py:502` |
| `GET /hr/payroll/runs`, `/{id}` | derived `hr.view` | yes | yes | `payroll_router.py:45,122` |
| `POST /hr/payroll/runs` (create run) | derived `hr.create` | yes | yes | `payroll_router.py:66` |
| `PUT /hr/payroll/runs/{id}/items/{iid}` | derived `hr.update` | yes | yes | `payroll_router.py:156` |
| `DELETE /hr/payroll/runs/{id}` (draft only) | derived `hr.delete` | yes | **no** | `payroll_router.py:192` |
| `POST /hr/payroll/runs/{id}/approve` | **explicit** `hr.payroll.approve` | yes | **no** | `payroll_router.py:212` |
| `POST /hr/payroll/runs/{id}/pay` | **explicit** `hr.payroll.pay` | yes | **no** | `payroll_router.py:273` |
| `GET /finance/cashboxes` | derived `finance.view` | yes | yes | `finance/router.py:86` |
| `GET /finance/extra-costs` | derived `finance.view` | yes | yes | `finance/router.py:452` |
| `POST /finance/extra-costs` | derived `finance.create` | yes | yes | `finance/router.py:479` |
| `DELETE /finance/extra-costs/{eid}` | derived `finance.delete` | yes | **no** | `finance/router.py:529` |
| `GET/POST /cashbox-sessions/*`, `GET /cashbox-sessions/active`, `.../totals` | **none enforced** (§1.6 security finding) | yes | yes | `mobile/router.py:406-588` |
| `POST /push/register`, `DELETE /push/{token}`, `GET /push/devices` (new, MA-2) | **none enforced** (auth-only) | yes | yes | `mobile/router.py:1154,1172` + MA-2 addition |

### 6.4 Payroll approve/pay gating (Scenario 4 of SPEC §5 — verified)

`Staff` screen's Payroll tab shows "Tasdiqlash"/"To'lash" buttons wrapped in
`PermissionGate(code: "hr.payroll.approve")` / `PermissionGate(code: "hr.payroll.pay")`
respectively. `manager`'s grant list (`rbac/permissions.py:177-219`) contains neither code
— confirmed by direct read, not inference. `admin` has both via `ALL_PERMISSIONS`.
`accountant` also has both (out of scope for this app, but noted for completeness since the
backend endpoint itself doesn't know which app is calling it).

### 6.5 Catalog mutation gating (Scenario 5 — both roles write to the same backend)

Create/edit buttons on Product and Category screens: `PermissionGate(code:
"warehouse.create")` for the "add" button, `PermissionGate(code: "warehouse.update")` for
"save edits" — both `admin` and `manager` pass, by design (REGOS-parity expects both roles
to manage catalog day-to-day). Delete gating differs per §1.5/§1.7: Category delete button
→ `PermissionGate(code: "warehouse.delete")` (admin-only, visually absent for manager, not
just disabled). Product "archive"/"unarchive" toggle → `PermissionGate(code:
"warehouse.product.archive")` (both roles).

### 6.6 Till-shift gating is cosmetic (§1.6) — stated plainly, not hidden

The More-hub tile for Till-shift and the `TillShiftScreen` itself are wrapped in
`PermissionGate(code: "finance.view")` as the most defensible available proxy, **not**
because the backend enforces anything on `/cashbox-sessions/*` (it enforces nothing — §1.6).
Both `admin` and `manager` hold `finance.view` today, so this is invisible in practice; it
exists purely so the client isn't making up a permission check with zero backing at all.
This is explicitly flagged for human/PM awareness in §10 — real server-side gating for
till-shift operations is a separate, future backend ticket.

---

## 7. FCM / push design — registration-only, no sender exists (§0 item 3)

**Scope decision (narrower than the POS reference, deliberately):** POS's
`fcm_service.dart` builds full foreground/background/terminated message handling and a
`kind` → route tap-through table, because POS at least has a plausible path to a real
Firebase project eventually. **ERP has literally zero Firebase artifacts anywhere in the
repo** (no placeholder `google-services.json`, no `firebase-admin` in any
`requirements.txt`, no service-account reference). Building out message-listener/tap-routing
logic against a sender that doesn't exist and has no scheduled ticket (SPEC §13 OQ5,
explicitly still open) is speculative engineering. **v1 `fcm_service.dart` does exactly
three things:**

1. `init()` — wraps `Firebase.initializeApp()` in try/catch (MA-3 authors a placeholder
   `android/app/google-services.json` with a fake `project_id`/`package_name` matching §3's
   `applicationId`, same pattern as POS's own placeholder stub — this exists only so the
   Gradle build doesn't fail on a missing file, not because a real project exists).
2. `registerForCurrentUser()` — called from `AuthState.login()`/`restoreFromStorage()` on
   success, **only if** the Settings push toggle is on (default: on). Requests notification
   permission, gets an FCM token (may legitimately fail against the placeholder project —
   caught, logged, never surfaced to the user), `POST /push/register {token, platform:
   "android", device_label}`.
3. `unregisterCurrentDevice()` — called from `AuthState.logout()` **before** clearing secure
   storage (same ordering requirement as the POS precedent — the unregister call needs a
   still-valid JWT), `DELETE /push/{token}`.

**No `FirebaseMessaging.onMessage`/`onBackgroundMessage`/`onMessageOpenedApp` listeners are
registered in v1.** There is nothing that will ever call them. If a real sender is built in
a future ticket (requires a new backend service-account integration, explicitly out of
scope here per SPEC §7 WON'T DO), that ticket re-opens this file to add them — it is not
free to add speculatively now.

**Settings screen (`settings_screen.dart`, MA-6) MUST show, next to the push toggle, static
text**: "Bildirishnoma funksiyasi hali faol emas — backend tomonidan jo'natish xizmati
ulanmagan" (translated: notification registration works, delivery is not guaranteed; do not
imply push notifications will arrive). This directly satisfies SPEC §9's risk callout and
`MA-6`'s own DoD line about not silently implying push works end-to-end.

**`GET /push/devices` (new, MA-2, §0 item 2) contract:**
```
GET /api/v1/push/devices
Headers: Authorization, X-Organization-Id (required by convention; the handler itself
         only needs user_id, matching the existing register/unregister pattern of
         filtering by user_id without an org filter — mobile/router.py:1172's DELETE
         already has no org_id filter, so this new endpoint matches that precedent rather
         than introducing an inconsistent new one)
200 OK → [{id: int, platform: string, device_label: string|null,
           last_used_at: string (ISO), created_at: string (ISO)}]
```
Used by Settings to show "N qurilma ro'yxatdan o'tgan" and let the user remotely
`DELETE /push/{token}` a lost device — a real, if small, usability win even with zero
delivery.

---

## 8. Data shapes and defensive parsing

### 8.1 Pagination — two different shapes exist for the same resource, app uses only one

`GET /warehouse/products` returns **two different response shapes** depending on whether
`warehouse_id` is passed (`warehouse/router.py:239-304`, `warehouse/service.py:154-235`):
- **With `warehouse_id`** (paginated, `on_hand`-aware): `{total: int, page: int, limit: int,
  items: [{id, name, sku, product_type, category_id, unit_id, default_cell_id,
  is_published_online, category_name, unit_name, on_hand, default_cell_code,
  product_type_label}]}`. `limit` is capped at 100 server-side regardless of what's
  requested (`warehouse/router.py:249`).
- **Without `warehouse_id`** (legacy flat list): a bare JSON array with a *different,
  richer* field set (`sale_price`, `wholesale_price`, `purchase_price`, `barcode`, `mxik`,
  `total_stock`, `is_archived`, `default_supplier_name`, ...) and **no pagination
  metadata at all**.

**Decision: `menu_service.dart` (MA-5) ALWAYS passes `warehouse_id`.** The Catalog screen
calls `GET /warehouse/warehouses` once on load, auto-selects the first result (most orgs
have exactly one — `auth/router.py`'s registration seed creates "Asosiy ombor" for every
new org), persists the choice in `shared_preferences`, and offers a simple dropdown switcher
only if more than one warehouse exists. This gives the app **one single, consistent,
paginated response shape** to parse, instead of needing two Dart models for one endpoint.
This decision is binding for `MA-5` — do not use the legacy flat-array mode.

### 8.2 Product category id is `int`, product id is `UUID` — do not conflate

`product_categories.id` / `CategoryIn.parent_id` are plain integers (`warehouse/router.py:121-123`).
`products.id` is a UUID string. Dart models: `Category.id: int`, `Product.id: String`.

### 8.3 Money/quantity fields serialize as JSON strings, not numbers — `num_parse.dart` (MA-3) is mandatory

FastAPI's default `jsonable_encoder` converts a `decimal.Decimal` to a **JSON string**
whenever the value carries a fractional/negative exponent (true for essentially every
money field in this schema — `12500.00` has exponent `-2`), and to a plain JSON **number**
only for a whole-valued Decimal (e.g. a quantity of exactly `3`, exponent `>= 0`). This is
not a customization this backend added — it's `jsonable_encoder`'s stock behavior — and the
COGS report handler already works around the resulting inconsistency itself by manually
calling `str()` on every Decimal before returning (`statistics/router.py:516-561`), which is
direct evidence this exact ambiguity has already caused friction in this codebase.
**`sale_price`, `purchase_price`, `wholesale_price`, `opened_balance`, `closed_balance`,
`total_income`, `total_expense`, `net_pay`, `base_salary`, `amount`, `on_hand`, and every
other money/quantity field in every response in §6.3 MUST be parsed through one shared
helper** (`num_parse.dart`, owned by MA-3): `num parseNum(dynamic v) => v is num ? v :
num.tryParse(v?.toString() ?? '') ?? 0`. No screen ticket re-implements this parsing inline.

### 8.4 `cashbox_sessions` row shape (till-shift) — known columns, tolerate unknowns

`mobile/router.py`'s session queries use `cs.*` (no explicit column list in the SQL), so the
exact column set isn't enumerable from the router file alone. Known columns from the
`INSERT`/`UPDATE` statements actually used (`mobile/router.py:452-559`): `id` (UUID),
`organization_id`, `cashbox_id` (int), `device_id` (int, nullable), `opened_by` (UUID),
`opened_balance`, `opened_diff`, `opened_note`, `status` ("open"|"closed"), `closed_by`,
`closed_at`, `closed_balance`, `closed_diff`, `closed_note`, `total_income`,
`total_expense`, `sale_count`, plus `opened_at` (implied default, not explicitly set in the
INSERT — confirm the actual default at `MA-6` build time via one `GET /cashbox-sessions`
call against the dev stack rather than assuming). **Dart's `TillShiftSession` model MUST
use a permissive/extra-tolerant `fromJson` (ignore unknown keys) rather than a strict one**,
since the full column list wasn't verified field-by-field against the DDL in this pass.

---

## 9. Out of scope (elaborated from SPEC §7, plus what almost got designed in here)

- **Checkout/POS-kassa screen** — SPEC §7, unchanged. This app's Orders screen is
  list+detail **view only**; no `POST /sale/sales` call exists anywhere in this app's
  service files.
- **Bluetooth printer/scale/cash-drawer integration** — SPEC §7, unchanged. `scanner_screen.dart`
  (§4.2) only calls `GET /warehouse/barcode-lookup` for product lookup; it never touches a
  physical scanner SDK beyond the phone camera's barcode-scan package (MA-6's implementation
  choice, architecturally insignificant).
- **Modifier/variant management** — SPEC §7, unchanged, no ERP equivalent (BOM is a
  manufacturing concept, not a customer-facing modifier).
- **Branch comparison** — SPEC §7, unchanged, no ERP branch/child-org concept exists.
- **iOS build** — SPEC §7, unchanged. v1 Android-only.
- **Offline mutation queueing** — SPEC §7, unchanged. `local_cache.dart` is read-only cache
  with a staleness badge; till-shift close, expense create, and payroll pay/approve all
  fail loud (a normal error dialog, not a silent queue) on `DioException` — matching the
  POS precedent's "fail loud for money" decision (SPEC §5 Scenario 6).
- **Full FCM foreground/background message handling and tap-through routing** — **almost
  got ported mechanically from the POS reference** (§7) — decided against it because there
  is no sender anywhere to produce a message to handle. If a real sender is ever built,
  that is a new ticket that reopens `fcm_service.dart`, not a silent v1 addition.
- **"Custom report builder" (user-defined report shape)** — **almost got designed in** by
  taking PM's `MA-4` ticket's `custom_reports_screen.dart` filename literally (§1.3) — ERP
  has no backend capability for this; the screen is repurposed into a fixed list of three
  pre-built reports instead.
- **Mobile photo upload for products** — **almost got designed in** by assuming parity with
  POS's `/products/:id/image` multipart endpoint (§1.4) — no equivalent exists in ERP; the
  product form uses a plain URL text field instead. A real upload flow would need a new
  backend file-storage endpoint, which is a new ticket, not this one's to invent.
- **Real server-side permission gating for `/cashbox-sessions/*` and `/push/*`** — **almost
  got silently "fixed" here** by adding a `require_permission` dependency to those endpoints
  as part of this design — **not done**, because that is a real backend authorization
  change affecting the existing mobile PWA (`apps/web/app/m/`) too, which also calls these
  same endpoints and was never scoped for review in this ticket. Flagged in §10 for
  PM/human-triggered follow-up, not fixed unilaterally.
- **i18n (uz/ru/en)** — not in SPEC's requirements for this app; ERP's web admin supports
  multiple locales but nothing in `SPEC-merchant-admin.md` asks for it here, and the backend
  error strings this app will display verbatim (e.g. the till-shift "on_hold sales" rejection
  message) are Uzbek-only regardless of client locale — building a translation layer around
  text the backend never localizes would be partial/misleading. Single-locale Uzbek for v1.
- **`GET /organizations/current` (org profile display)** — contract exists and is safe to
  call, but no screen in this design requires it (Settings only needs the org *name*, which
  is already available from the `GET /organizations/mine` response cached at login). Noted
  as available-but-unused, not wired into any ticket's file list, to avoid an unnecessary
  extra network call.

---

## 10. Items needing human/PM sign-off before or during `MA-2`..`MA-6`

1. **Android `applicationId`/display name** (§0 item 6, §3) — `uz.aniqerp.merchantadmin` /
   "Aniq ERP Admin" is a proposal only, per SPEC §13 OQ6's explicit requirement for human
   confirmation (app-store-visible branding).
2. **Security finding: `mobile` module has no authorization/org-membership gate at all**
   (§1.6) — this predates `MA-1` and affects more than this app (the existing mobile PWA at
   `apps/web/app/m/` calls the same ungated endpoints). This needs its own backend security
   ticket, scoped and reviewed independently — **not** something `MA-2` should attempt as a
   side effect of its narrow, additive gap-closing scope. Logged to `FOUND-DEBT.md`
   (DEBT-004/DEBT-005).
3. **"Two native-stack" tradeoff** (SPEC §4/§9, inherited, not resolved here) — unchanged by
   this design; still an open question for whoever owns the `SPEC-desktop-mobile-apps.md`
   decision.
4. **`flutter-dev` vs `frontend-dev` agent-role naming** (SPEC §13 OQ2) — this design doc
   describes ticket work normally; the dispatch-time role-name resolution is the CTO's
   concern, not this document's, per this task's own framing.
5. **Whether a real push sender is ever built** (SPEC §13 OQ5, still open) — this design
   explicitly does NOT schedule that work; §7's registration-only scope stands until a
   separate ticket changes it.

---

## 11. Rollback plan

No backend schema changes in this ticket set (§0/§6 — this app consumes only existing,
already-shipped endpoints; `MA-2`'s only additions are one new additive `GET` endpoint and,
if needed, one explicit `require_permission` dependency added to an existing `/warehouse/categories`
mutation — both are purely additive, non-breaking, and trivially revertable by deleting the
new endpoint / dependency line). `apps/merchant-admin` is a brand-new, independent Flutter
project directory — rollback for the whole initiative is "do not publish the app" / delete
the directory; it shares no code path with `apps/web` or the existing mobile PWA and cannot
regress either by existing.

---

## 12. Clarifications

*(none yet — this is the initial FROZEN issuance. Future clarifications requested via
`tickets/QUESTIONS.md` will be appended below this line with a date, per `tickets/SDLC.md`'s
conflict-resolution protocol. Do not edit the sections above in place once a builder ticket
has started against them — append-only from here down.)*
