# SC-6 — Admin UI: Kiosk Device Provisioning (settings/kiosk-devices)

**Owner Role**: frontend-dev
**Depends On**: none to *start* — the `/api/v1/kiosk-devices` request/response shapes are
already frozen in `DESIGN-self-checkout-auth.md`, so this ticket can be built against that
documented contract (mocked backend) in parallel with SC-1/SC-2. Real integration testing
needs SC-2 merged.
**Blocks**: none
**Estimated Size**: S (1-2 kun)
**Priority**: P1
**Spec/Design Reference**: `tickets/DESIGN-self-checkout-auth.md` — "Fayl tuzilishi" (names the
exact new file: `apps/web/app/(dashboard)/settings/kiosk-devices/page.tsx`), "API kontrakti
(FREEZE)"

---

## Goal

A small admin page where staff with `kiosk.*` permissions issue, rename, rotate, and revoke
kiosk device tokens. This is where the "approved request → provisioned device" loop closes.

---

## Rationale — this is a NEW page, confirmed not an extension of the existing one

Checked against the actual codebase: `apps/web/app/(dashboard)/settings/devices/page.tsx`
already exists today, but it manages the unrelated `devices` table (printer/scanner/scale
*hardware metadata* — `kind`, `connection`, `address`; no secrets, no auth consequence). DESIGN
explicitly rejected bolting kiosk tokens onto that table/page (mixing "equipment label" and
"bearer credential" concerns, and that page's edit permissions are broader than the tight
`kiosk.*` scope this feature needs). DESIGN's own file list names the new page explicitly:
`settings/kiosk-devices/page.tsx` — a sibling of `settings/devices/`, not a tab/section inside
it. Build it as its own route.

---

## Files Likely Touched

- `apps/web/app/(dashboard)/settings/kiosk-devices/page.tsx` — new
- `apps/web/lib/menu.config.ts` — add one nav entry under the `settings` section (next to the
  existing `settings_devices` entry, line ~267), gated on `kiosk.view` permission, labeled
  distinctly from "Устройства" (e.g. "Kiosk qurilmalari" / "Самообслуживание") so staff don't
  confuse the two pages
- `apps/web/i18n/messages/{uz,ru,en}.json` — new strings (list columns, create modal, one-time
  token display, rotate/revoke confirmations)
- No backend files — this ticket is frontend-only, consumes SC-2's endpoints

---

## Acceptance Criteria

- [ ] List view: `name`, `cashbox_name`, `warehouse_name`, `token_prefix` (never the full token),
  `status`, `last_used_at`, `created_at` — per DESIGN's documented `GET /kiosk-devices` response
- [ ] "Yangi qurilma" modal: `name` + `cashbox_id` dropdown (existing cashboxes for this org) →
  on success, shows the **full plaintext token exactly once**, with a copy-to-clipboard button
  and an explicit "this will not be shown again, write it down now" warning — modeled on how
  this app already handles the one-time invitation-token display in the RBAC module (check that
  existing UI for the interaction pattern before building a new one from scratch)
- [ ] "Rotate" button per row: confirms ("eski token zudlik bilan ishdan chiqadi — davom
  etasizmi?"), then shows the new plaintext token once, same one-time-display treatment as create
- [ ] "Revoke" button per row: confirms, then calls `DELETE`, row status flips to `revoked`
  immediately in the UI (no stale-looking "active" badge after a successful revoke)
- [ ] Rename / change-cashbox via `PUT` — simple edit form, no token exposure
- [ ] Page and nav entry are gated on `kiosk.view` (list/page visibility) and
  `kiosk.create`/`kiosk.update`/`kiosk.delete` (action buttons) — confirm a user without these
  permissions gets a `403`-appropriate UI state, not a silent empty list that looks like "no
  devices exist"
- [ ] Nothing on this page ever re-displays a previously-issued token (list view only ever shows
  `token_prefix`) — if a user navigates away from the one-time-display modal without copying it,
  the only recovery path is Rotate (issuing a new one), matching the backend's "no plaintext
  storage" guarantee

---

## Technical Notes

- **Antipattern**: do not add a kiosk tab/section inside the existing `settings/devices/
  page.tsx`. Confirmed above this is a deliberate architect decision, not an oversight to "clean
  up" by merging.
- Match this app's existing data-table/modal components (`DataTable`, `Modal`, `ConfirmDialog` —
  visible in `settings/devices/page.tsx`'s imports) rather than introducing new UI primitives for
  a page this small.
- `settings/devices/page.tsx.corrupted` and sibling `.corrupted` files exist in this directory
  from an earlier session — do not touch, rename, or "fix" them as part of this ticket; out of
  scope and not this ticket's concern.

---

## Definition of Done

- [ ] Mechanical: `npm run build` succeeds
- [ ] Agentic: qa-reviewer BLOCKER yo'q
- [ ] Behavioral: as `admin`, create a kiosk device, copy the token, rotate it (old token value
  no longer shown anywhere), revoke it, confirm row shows `revoked`
- [ ] Behavioral: as a role without `kiosk.*` permissions, confirm the nav entry/page is not
  reachable
- [ ] Human-gate: merge
