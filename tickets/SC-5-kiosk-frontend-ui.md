# SC-5 — Kiosk Customer-Facing UI (scan → cart → pay → wait → done)

**Owner Role**: frontend-dev
**Depends On**: SC-2 (`GET /kiosk/session` contract — frozen, can start against it as soon as
SC-2's shape is known, doesn't need to wait for SC-2's code to be merged), SC-3 (checkout +
order-status-poll contract — recommend SC-3's owner publish the exact request/response JSON
early so this ticket isn't blocked waiting for full backend completion)
**Blocks**: none
**Estimated Size**: M (2-4 kun)
**Priority**: P1
**Spec/Design Reference**: `tickets/SPEC-self-checkout.md` — Scenarios 1-6; "Talablar" →
"Uskuna"; "Tegishli modullar" (BarcodeScanner reuse, `(shop)/` route-group pattern reference)

---

## Goal

A deliberately different UI from every existing sale surface in this app: no staff login
screen, no name-search product grid, no admin chrome — a simplified, physically-standing-at-a-
kiosk flow a customer with zero training can complete: scan → cart → pay → wait → done.

---

## Rationale

Every existing checkout surface in this app assumes either a logged-in staff member
(`pos/page.tsx`, `m/pos/page.tsx`) or a fully remote, unsupervised customer (`(shop)/` storefront,
B2B portal). This is the first "physically present, not staff" screen. SPEC is explicit that
this should feel like a kiosk, not a stripped-down POS — it reuses the `(shop)/` route-group
*pattern* (layout separation) but is its own independent route group, not a copy-paste of
storefront business logic.

---

## Files Likely Touched

- `apps/web/app/(kiosk)/kiosk/layout.tsx` — new. No nav sidebar, no staff-session chrome,
  fullscreen-first (CSS/JS Fullscreen API per SPEC — no native app-level kiosk lock, that's
  explicitly out of scope)
- `apps/web/app/(kiosk)/kiosk/page.tsx` — new. Scan screen (device identifies itself via
  `GET /kiosk/session` on load, shows store/cashbox name, or "Qurilma faol emas" if `401`)
- `apps/web/app/(kiosk)/kiosk/cart/page.tsx` (or equivalent in-flow state, implementer's call) —
  cart screen, running total, visible warning as it approaches `max_cart_amount` from
  `/kiosk/session`
- `apps/web/app/(kiosk)/kiosk/pay/page.tsx` — checkout trigger + the blocking wait screen
  (polls `GET /kiosk/order/{sale_id}` per SC-3's documented polling contract, ~90s timeout →
  "Xodimga murojaat qiling" escalation message, per SPEC)
- Reuse `BarcodeScanner` component from `apps/web/app/m/pos/page.tsx` — **do not** fork or
  rewrite it; if it needs a prop/behavior tweak for kiosk use, extract it to a shared location
  rather than duplicating
- `apps/web/i18n/messages/{uz,ru,en}.json` — new kiosk-specific strings
- No changes to `apps/web/lib/menu.config.ts` — kiosk is not a dashboard nav item, it's a
  standalone customer-facing route, physically bookmarked/kiosk-locked on the device itself

---

## Acceptance Criteria

- [ ] No login screen anywhere in the `(kiosk)/` route group — the device identifies itself via
  its bearer token (stored once at device setup, e.g. in a query param/localStorage at
  provisioning time — exact mechanism is this ticket's implementation detail, but it must never
  prompt a human for credentials)
- [ ] Scan screen uses the reused `BarcodeScanner` component — no new camera/scan integration
  code written from scratch
- [ ] Scanning a weight-sold product's barcode (if it even has one) shows "mahsulot topilmadi" —
  confirmed by relying on SC-3's catalog filter, this screen does not need its own kg/g detection
  logic, it just trusts the backend's "not found" response (Scenario 4)
- [ ] Cart total updates live; if it would exceed `max_cart_amount`, "To'lash" is blocked
  client-side *and* the backend's `422 cart_limit_exceeded` is handled gracefully if the
  client-side check is ever bypassed/stale (don't rely on frontend validation alone — SC-3 owns
  the real enforcement)
- [ ] **Waiting-for-payment screen is a real, separate, un-skippable screen** — after checkout
  returns, the UI does not show "Tasdiqlandi, xayr" until polling `GET /kiosk/order/{sale_id}`
  returns `paid`. This is not a loading spinner that optimistically assumes success; it is a
  distinct state that can resolve to failure/timeout.
- [ ] Timeout (~90s per SC-3's contract) → escalation screen: "Xodimga murojaat qiling", not a
  generic error — and this screen does **not** auto-retry into a "success" state
- [ ] `payment.mode = "unavailable"` response (today's real state with no merchant credentials
  active) is handled as its own explicit screen — "To'lov tizimi hali ulanmagan — kassaga
  murojaat qiling" — not a generic error page, and not hidden behind a "coming soon" placeholder
  that implies it's a future feature rather than today's actual blocker
- [ ] `401` from any kiosk endpoint (revoked device) shows "Qurilma faol emas — administratorga
  murojaat qiling" and stops the flow — no retry loop hammering a dead token
- [ ] Fullscreen API used for an immersive kiosk feel; no OS-level kiosk-lock claims made in the
  UI copy (that's explicitly out of scope per SPEC — a native MDM lock is a separate concern)

---

## Technical Notes

- **Antipattern**: do not import/reuse storefront (`(shop)/`) business logic/hooks directly —
  DESIGN rejected the storefront's anonymous-everywhere auth model for kiosk specifically
  because the risk profile is different (real stock walking out the door vs. a fake online
  order). Copy the *route-group layout pattern* if useful, not the checkout logic.
- Do not build a name-search product grid (SPEC: SHOULD/MAY only, explicitly not required for
  V1 — self-service always starts from a physical scan).
- Do not wire up Bluetooth ESC/POS receipt printing in this ticket unless trivial — SPEC marks
  digital receipt (on-screen/SMS link) as the primary path; printer integration is a nice-to-have
  that risks "paper ran out" operational problems on an unsupervised kiosk, explicitly flagged as
  not a MUST.

---

## Definition of Done

- [ ] Mechanical: `npm run build` (or repo's equivalent) succeeds for the new route group
- [ ] Agentic: qa-reviewer BLOCKER yo'q
- [ ] Behavioral: full manual walkthrough on a test device/browser — scan 3 products → cart →
  pay → (with payments disabled) see "To'lov tizimi hali ulanmagan" screen, not a crash or a
  false-success screen
- [ ] Behavioral: revoke the test device mid-session (via SC-2's admin endpoint) → next kiosk
  request shows the "qurilma faol emas" screen, not a silent failure
- [ ] Human-gate: merge
