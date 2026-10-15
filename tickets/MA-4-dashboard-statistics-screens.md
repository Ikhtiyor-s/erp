# MA-4 — Dashboard + Statistics/Reports screens

**Owner role**: flutter-dev
**Depends on**: MA-1 (frozen endpoint contract), MA-2 (if any statistics-adjacent gap was
flagged — confirm with `DESIGN-merchant-admin.md` before assuming none)

## Goal

Build the Dashboard (KPI summary) screen and the Statistics/Reports screens against the
existing `statistics` module endpoints, with the COGS/finance-sensitive report hidden for
roles lacking `statistics.cogs.view`.

## Files likely touched

- `apps/merchant-admin/lib/services/dashboard_service.dart`
- `apps/merchant-admin/lib/services/statistics_service.dart`
- `apps/merchant-admin/lib/screens/dashboard_screen.dart`
- `apps/merchant-admin/lib/screens/statistics/statistics_overview_screen.dart`
- `apps/merchant-admin/lib/screens/statistics/sales_history_screen.dart`
- `apps/merchant-admin/lib/screens/statistics/custom_reports_screen.dart`
- `apps/merchant-admin/lib/widgets/revenue_chart.dart`

## How we'll know it's done

- Against the real backend (`docker compose up -d`), Dashboard shows
  `today_revenue`/`month_revenue`/`cash_total`/`total_debt`/`stock_value` matching values
  returned by `GET /statistics/dashboard` for the same org (spot-check via curl or
  `/docs`).
- Sales-summary / sale-by-category / sale-by-employee / sale-by-payment-type screens render
  real data for an `admin` login.
- Logging in as a seeded `manager` vs an `admin`: COGS report tile is visible for both only
  if `manager`'s granted permissions include `statistics.cogs.view` — verify against the
  actual `ROLE_GRANTS["manager"]` list in `rbac/permissions.py` (it currently does include
  it; if `DESIGN-merchant-admin.md` or a later RBAC change removes it, the tile must hide,
  not crash).
- Branch-comparison screen is explicitly NOT built (SPEC §7 WON'T DO) — do not add it even
  as a stub.
- Changed files reported.

## Owner role

flutter-dev

## Depends on

MA-1, MA-2
