# SC-2 — Kiosk Device-Auth Dependency + Admin Provisioning Endpoints

**Owner Role**: backend-dev
**Depends On**: SC-1 (needs `kiosk_devices` table + `kiosk.*` permission codes)
**Blocks**: SC-3 (checkout flow needs `get_current_kiosk_device()` to gate its endpoints),
SC-5 (kiosk frontend needs `GET /kiosk/session` to exist), SC-6 (admin UI needs the real
`/kiosk-devices` endpoints to integrate against, though it can build UI in parallel beforehand)
**Estimated Size**: M (1-3 kun)
**Priority**: P1
**Spec/Design Reference**: `tickets/DESIGN-self-checkout-auth.md` — "Fayl tuzilishi", "API
kontrakti (FREEZE)", "RBAC", "Xavfsizlik", "Tests (acceptance)" sections. The API shapes in
this ticket are frozen — implement them as specified, do not redesign the response bodies.

---

## Goal

Build the fourth auth model this app now has: a device-bound bearer credential. Two halves,
both frozen by DESIGN: (1) `get_current_kiosk_device()` — the dependency every `/api/v1/kiosk/*`
endpoint (built in SC-3) will use instead of a staff JWT; (2) the admin-facing
`/api/v1/kiosk-devices/*` CRUD that staff use (under normal JWT + RBAC) to issue/rotate/revoke
those device tokens.

---

## Rationale

Mirrors the existing invitation-token pattern almost exactly
(`apps/api/app/modules/rbac/router.py:19-21,474-475` — `secrets.token_urlsafe(32)` +
`hashlib.sha256(...).hexdigest()`, no bcrypt, because the token is high-entropy random, not a
human-chosen password). The one new piece of judgment: the token must be checkable with zero
caching (revoke/rotate takes effect on the very next request) — this rules out JWT, which is
why DESIGN chose a flat DB lookup instead.

---

## Files Likely Touched

- `apps/api/app/modules/kiosk/__init__.py` — new
- `apps/api/app/modules/kiosk/auth.py` — new. `get_current_kiosk_device()` FastAPI dependency:
  parse `Authorization: Bearer kiosk_<token>`, strip `kiosk_` prefix, SHA-256 hash the rest,
  look up `kiosk_devices` by `token_hash`, reject (401, single generic message, no reason
  disclosed) if missing/`status != 'active'`, else update `last_used_at`/`last_used_ip` and
  return the device row (with its `organization_id`, `cashbox_id`).
- `apps/api/app/modules/kiosk/devices_router.py` — new. Admin CRUD:
  `POST /api/v1/kiosk-devices`, `GET /api/v1/kiosk-devices`,
  `POST /api/v1/kiosk-devices/{id}/rotate`, `PUT /api/v1/kiosk-devices/{id}`,
  `DELETE /api/v1/kiosk-devices/{id}` (soft, sets `status='revoked'`)
- `apps/api/app/modules/kiosk/router.py` — new, minimal for this ticket: only
  `GET /api/v1/kiosk/session` (device self-identification — SC-3 adds the rest of
  `/api/v1/kiosk/*` on top of this same router file)
- `apps/api/app/modules/rbac/middleware.py` — `URL_MODULE["kiosk-devices"] = "kiosk"`;
  `SKIP_PATHS_PREFIX` += `"/api/v1/kiosk/"`
- `apps/api/app/main.py` — register `kiosk.router` and `kiosk.devices_router`
- `apps/api/tests/test_kiosk_auth.py` — new
- `apps/api/tests/test_kiosk_devices_router.py` — new

---

## Acceptance Criteria

All request/response shapes below are copied from the frozen DESIGN contract — implement
exactly, do not add/rename fields without going back to the architect.

### `POST /api/v1/kiosk-devices` (staff JWT + RBAC, `kiosk.create`)
- [ ] Request `{ "name": str, "cashbox_id": int }` → `201`
  `{ "id", "name", "cashbox_id", "status": "active", "token": "kiosk_<plaintext>", "token_prefix" }`
- [ ] `token` plaintext is returned **only in this response** — server never stores it (only
  the hash), and no other endpoint (including `GET /kiosk-devices`) ever returns it again
- [ ] `422` if `cashbox_id` belongs to another org or doesn't exist
- [ ] `403` if caller lacks `kiosk.create`

### `GET /api/v1/kiosk-devices` (`kiosk.view`)
- [ ] Returns list with `token_prefix` only (never `token`/`token_hash`), joined with
  `cashbox_name`/`warehouse_name` for admin-UI display

### `POST /api/v1/kiosk-devices/{id}/rotate` (`kiosk.update`)
- [ ] Issues a new token, invalidates the old one **immediately** (no grace period — old token
  gets `401` on its very next request, same request that triggers the rotate response)
- [ ] Response: `{ "token": "kiosk_<new plaintext>", "token_prefix" }`

### `PUT /api/v1/kiosk-devices/{id}` (`kiosk.update`) / `DELETE .../{id}` (`kiosk.delete`)
- [ ] `PUT` updates `name`/`cashbox_id` → `{ "ok": true }`
- [ ] `DELETE` sets `status='revoked'` (soft-delete) → `{ "ok": true }`; device gets `401` on
  every subsequent `/api/v1/kiosk/*` call, immediately, no caching

### `GET /api/v1/kiosk/session` (device-token auth, no staff JWT)
- [ ] `200` with `device_id`, `device_name`, `organization_name`, `cashbox_id`, `cashbox_name`,
  `warehouse_id`, `warehouse_name`, `max_cart_amount` (read from
  `app_settings[org]['kiosk'].max_cart_amount`, `null` if unset = unlimited)
- [ ] `401` for missing/unknown/revoked token — **one generic message**, do not distinguish
  "unknown" from "revoked" in the response body (matches storefront's 404-for-everything
  caution already used elsewhere in this app)

### Middleware wiring
- [ ] `/api/v1/kiosk/*` is **not** gated by the human RBAC middleware (added to
  `SKIP_PATHS_PREFIX`) — org/cashbox/warehouse are resolved from the device token, never from
  an `X-Organization-Id` header
- [ ] `/api/v1/kiosk-devices/*` **is** gated normally by RBAC middleware (staff JWT required,
  `kiosk.view/create/update/delete` enforced) — `URL_MODULE` entry added so this isn't
  accidentally skipped too

### Tests (named per DESIGN's own test list — implement these exact cases)
- [ ] `test_kiosk_auth.py::test_valid_token_resolves_device`
- [ ] `test_kiosk_auth.py::test_revoked_token_401`
- [ ] `test_kiosk_auth.py::test_unknown_token_401`
- [ ] `test_kiosk_auth.py::test_rotate_invalidates_old_token_immediately`
- [ ] `test_kiosk_devices_router.py::test_create_requires_kiosk_create_permission`
- [ ] `test_kiosk_devices_router.py::test_token_shown_once_not_in_list_response`
- [ ] `test_kiosk_devices_router.py::test_cross_tenant_isolation` (Org B admin cannot
  view/rotate/revoke Org A's kiosk device — `404`, not `403`, don't confirm it exists)

---

## Technical Notes

- **Antipattern**: do not reuse/extend `devices` table or its router — DESIGN rejected this
  explicitly (mixing "equipment metadata" with "auth secret" concerns). `kiosk_devices` is
  fully independent.
- **Antipattern**: do not put a `kiosk_` prefix-stripping regex anywhere security-sensitive —
  the prefix is cosmetic only (DESIGN: "xavfsizlik chegarasi emas"), the real entropy is the
  32-byte `token_urlsafe` suffix. Don't accidentally validate on the prefix instead of the hash.
- Audit logging: this app's `audit/middleware.py` already does not log raw headers (verified by
  architect) — no new work needed here, just don't introduce a new log line that dumps
  `Authorization`.
- `GET /kiosk/session` is the only kiosk-facing endpoint in this ticket. Catalog, checkout, and
  order-polling endpoints are SC-3's scope — don't scope-creep into them here even though they
  live in the same `kiosk/router.py` file.

---

## Definition of Done

- [ ] Mechanical: `pytest apps/api/tests/test_kiosk_auth.py apps/api/tests/test_kiosk_devices_router.py -v` — 0 fail
- [ ] Agentic: qa-reviewer BLOCKER yo'q
- [ ] Behavioral: Postman — create kiosk device as admin → copy token → `GET /kiosk/session`
  with that token succeeds → revoke device → same request now `401`
- [ ] Human-gate: merge
