# MA-6 — Orders (read-only) + Till-shift + Staff + Expenses + Settings screens

**Owner role**: flutter-dev
**Depends on**: MA-1 (frozen contract), MA-2 (any backend gap this area needs — e.g. push
devices list), MA-3 (shell/nav/auth)

## Goal

Build the remaining back-office screens: read-only order/sale status list, cashbox-session
(till-shift) open/close reusing the existing `mobile` module smena endpoints, staff
(employees/attendance/payroll-view), expenses (`finance.extra-costs`), and a minimal
settings screen (push token registration, logout).

## Files likely touched

- `apps/merchant-admin/lib/services/orders_service.dart` (read-only: list/detail of sales —
  no checkout, no payment capture; see SPEC §7 WON'T DO)
- `apps/merchant-admin/lib/services/till_shift_service.dart` (calls
  `/cashbox-sessions/open`, `/{id}/close`, `/active`, `/{id}/totals` — no reimplementation
  of smena logic client-side)
- `apps/merchant-admin/lib/services/staff_service.dart`
- `apps/merchant-admin/lib/services/expenses_service.dart`
- `apps/merchant-admin/lib/services/settings_service.dart`
- `apps/merchant-admin/lib/screens/orders_screen.dart`
- `apps/merchant-admin/lib/screens/till_shift_screen.dart`
- `apps/merchant-admin/lib/screens/staff_screen.dart`
- `apps/merchant-admin/lib/screens/expenses_screen.dart`
- `apps/merchant-admin/lib/screens/settings_screen.dart`
- `apps/merchant-admin/lib/screens/more_screen.dart`

## How we'll know it's done

- Opening a shift (`POST /cashbox-sessions/open`) and closing it (`POST
  /cashbox-sessions/{id}/close`) from the app produces matching rows in `erp-postgres`'s
  `cashbox_sessions` table (verify via `docker exec erp-postgres psql -U erp -d erp`).
- If a sale is `on_hold` for the org, attempting to close the shift from the app surfaces
  the backend's existing REGOS-parity rejection message verbatim — the app does not retry
  or silently swallow it.
- Staff list loads from `GET /hr/employees`; attendance clock-in/out works against
  `/hr/attendance/clock-in`/`clock-out`.
- Payroll "approve"/"pay" actions are visible only when the logged-in role's
  `GET /rbac/me/permissions` response includes `hr.payroll.approve`/`hr.payroll.pay`
  respectively (per `rbac/permissions.py`, `manager` lacks both — verify the screen hides
  them for a `manager` login and shows them for `admin`/`accountant`).
- Expense creation posts to `POST /finance/extra-costs` and appears in the list immediately.
  No Bluetooth printer/scanner hardware integration is added (SPEC §7 WON'T DO) — barcode
  scan, if included, is product-lookup only, reusing existing
  `warehouse.product.barcode_view`-gated endpoints.
- Settings screen registers a push token via `POST /push/register` and clearly labels the
  feature as not-guaranteed-to-deliver if `DESIGN-merchant-admin.md` confirmed no sender
  service exists (SPEC §9 risk — do not silently imply push notifications work end-to-end).
- Changed files reported.

## Owner role

flutter-dev

## Depends on

MA-1, MA-2, MA-3
