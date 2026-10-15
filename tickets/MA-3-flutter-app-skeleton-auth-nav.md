# MA-3 — Flutter app skeleton: auth, API client, permission-driven navigation

**Owner role**: flutter-dev (see `SPEC-merchant-admin.md` §9/§13 — this role does not exist
yet in this repo's agent roster; human must decide whether `frontend-dev` absorbs this or a
new agent card is created, before this ticket is assigned)
**Depends on**: MA-1 (must build against the frozen file tree + route table in
`DESIGN-merchant-admin.md`, not improvise structure)

## Goal

Scaffold `apps/merchant-admin` (new Flutter project), wire login + token storage + API
client (Dio, `Authorization` + `X-Organization-Id` headers, 401-refresh), and a `go_router`
shell whose bottom-nav/tab visibility is driven by `GET /rbac/me/permissions`'s
`permissions` array — never by a hardcoded role-name string.

## Files likely touched

- `apps/merchant-admin/pubspec.yaml`, `analysis_options.yaml`, `android/` (new Flutter
  project scaffold, per `DESIGN-merchant-admin.md`'s applicationId decision)
- `apps/merchant-admin/lib/main.dart`, `lib/config.dart`, `lib/router.dart`
- `apps/merchant-admin/lib/state/auth_state.dart`
- `apps/merchant-admin/lib/services/api_client.dart`, `auth_service.dart`, `storage.dart`,
  `permissions_service.dart` (new — wraps `GET /rbac/me/permissions`, exposes a
  `hasPermission(code)` check used by every nav-gating decision in later tickets)
- `apps/merchant-admin/lib/screens/login_screen.dart`
- `apps/merchant-admin/lib/widgets/app_shell.dart`
- `apps/merchant-admin/test/widget_test.dart`

## How we'll know it's done

- `flutter test` passes (default smoke test at minimum).
- Manual run against the local `docker compose` ERP stack: logging in as a seeded `admin`
  user and a seeded `manager` user shows different bottom-nav tabs/visible actions,
  verified by checking which permission codes gate which tab in code (not by eyeballing —
  cite the `hasPermission(...)` call per gated tab).
- `docker logs --since=2m erp-api` during a manual login+one-list-call shows
  `X-Organization-Id` present on every authenticated request.
- Logout clears secure storage and returns to `/login`.
- Changed/created files reported.

## Owner role

flutter-dev

## Depends on

MA-1
