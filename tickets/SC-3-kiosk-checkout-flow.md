# SC-3 — Kiosk Catalog + Checkout Flow (create_sale_core, payment integration point, blocking wait screen)

**Owner Role**: backend-dev
**Depends On**: SC-2 (needs `get_current_kiosk_device()` to gate these endpoints, and the
device row's `cashbox_id`/`organization_id` to resolve warehouse/org)
**Blocks**: SC-4 (staff queue filters on the `source_type='sale_kiosk'` marking this ticket
creates), SC-5 (kiosk frontend needs this endpoint's real response shapes)
**Estimated Size**: M (1-3 kun)
**Priority**: P1
**Spec/Design Reference**: `tickets/SPEC-self-checkout.md` — Scenarios 1,2,4,5,6,7; "Talablar"
→ "Katalog", "Checkout/to'lov", "Loss-prevention"; "Qoldiq tavakkal" (the MUST about the
blocking wait screen lives in THIS ticket, not deferred — see Acceptance Criteria below).

---

## Goal

Implement the actual kiosk sale: barcode-scannable catalog lookup, `POST /api/v1/kiosk/checkout`
that creates a real sale via the shared `create_sale_core()`, and the blocking
"waiting for payment" poll endpoint the kiosk screen depends on so it never tells a customer
they can leave before payment is actually confirmed.

---

## Rationale

This is the core of the feature and also where the architect's named residual risk lives:
`create_sale_core()` deducts stock at sale-creation time, before payment is confirmed — fine
for a storefront order (goods not yet shipped, staff can still cancel), materially different for
a kiosk where the customer is physically holding the goods already. SPEC's accepted mitigation
is NOT "fix `create_sale_core()`" (out of scope, shared by 3 other callers) — it's: never show
the customer a "you can go" screen until `paid`, and give staff a cheap way to see/cancel stuck
orders (SC-4). This ticket owns the first half; it is not optional and not deferrable to a
"nice to have" — it is a MUST in the approved SPEC, not a SHOULD.

---

## Files Likely Touched

- `apps/api/app/modules/kiosk/router.py` — add to the file started in SC-2:
  - `GET /api/v1/kiosk/catalog` (or `/catalog/{barcode}`) — barcode lookup
  - `POST /api/v1/kiosk/checkout`
  - `GET /api/v1/kiosk/order/{sale_id}` — status poll
- `apps/api/app/modules/kiosk/service.py` — new, calls
  `app/modules/sale/service.py::create_sale_core()` (**do not** duplicate its logic, SPEC MUST:
  "yangi, parallel sotuv-yozish yo'li qurilmasin")
- `apps/api/app/db/schema_patches.py` — `CREATE TABLE IF NOT EXISTS kiosk_orders (...)` — **not
  fully specified in DESIGN**, this ticket must design its minimal shape: `id`, `sale_id` (FK
  `sales.id`), `device_id` (FK `kiosk_devices.id`), `order_number`, `payment_mode`, `status`,
  `requires_staff_check BOOLEAN DEFAULT FALSE` (reserved column per SPEC MAY — add the column,
  do not build any UI/logic that reads it), `created_at`. Keep additive (`IF NOT EXISTS`), no
  changes to existing tables.
- `apps/api/app/modules/idempotency/middleware.py` — add
  `("POST", "/api/v1/kiosk/checkout")` to `_WHITELIST`; add an org-resolver for this path
  (device-token based, same shape as `_resolve_portal_order_org`)
- `apps/api/app/modules/integration/payments/base.py` — read-only integration point, reuse
  existing `click`/`payme` surface — **no new payment protocol code**
- `apps/api/tests/test_kiosk_checkout.py` — new

---

## Acceptance Criteria

### Catalog (SPEC Scenario 4, Talablar → Katalog)
- [ ] Kiosk catalog lookup only returns products where `is_active=TRUE AND is_archived=FALSE
  AND is_service=FALSE AND barcode IS NOT NULL AND units.short_name NOT IN ('kg','g')` — weight-
  sold products are invisible to kiosk, full stop, not just "hidden by default"
- [ ] Price and stock are always read server-side from the device's bound warehouse
  (`cashboxes.warehouse_id` via the device's `cashbox_id`) — never trust anything the client
  sends about price/availability

### Checkout (SPEC Scenario 1, 2, 5, 6, 7)
- [ ] `POST /api/v1/kiosk/checkout` creates a real sale via `create_sale_core()` — same function
  staff POS/B2B/B2C use, no parallel write path
- [ ] Server recomputes every line's price from `products.sale_price` at checkout time; any
  `price` field the client sends in the request body is **ignored**, never trusted (Scenario 6 —
  explicitly the opposite of staff POS's existing "client sends price" contract)
- [ ] Endpoint accepts `Idempotency-Key` header (wired to SC-2's whitelist entry) — double-tap/
  network-retry protection
- [ ] If cart total exceeds `app_settings['kiosk'].max_cart_amount` (org-level, `null` =
  unlimited): `422`, `code: "cart_limit_exceeded"`, **no sale created, no stock touched**
  (Scenario 2 — this check must run before calling `create_sale_core()`, not after)
- [ ] Every kiosk sale is tagged `source_type='sale_kiosk'` on the sale/stock_movement/
  accounting-journal rows `create_sale_core()` already supports a `source_type` parameter for —
  this is what lets SC-4's staff queue and future shrinkage reports distinguish kiosk sales
- [ ] Every kiosk sale writes a full item-level `audit_log` entry (product, qty, price, device
  id), `user_id=None`, same pattern as storefront checkout
- [ ] Cross-tenant isolation: `GET /api/v1/kiosk/order/{sale_id}` with another org's `sale_id`
  → `404` (Scenario 7 — no existence/reason disclosure)
- [ ] Cash is **not** an accepted payment method in V1 (SPEC MUST NOT) — only whatever
  click/payme currently expose

### Payment integration point — reuses existing stub, does not fake real money movement
- [ ] Checkout calls into the existing `integration/payments/base.py` surface exactly as it
  exists today — no new payment protocol, no new provider code
- [ ] **If both Click and Payme are `enabled=false`** (today's actual state — no real merchant
  credentials activated anywhere in this codebase, same blocker already tracked elsewhere in
  this project): checkout still returns `201`, but `payment.mode = "unavailable"`, and the sale
  is left in `awaiting_payment` status for a staff member to resolve manually (Scenario 5 — this
  is today's real behavior, not a hypothetical edge case, and this ticket must not hide it behind
  a "TODO: enable payments later" comment that pretends it already works)
- [ ] **Explicit non-goal, called out so nobody mistakes this ticket for shipping real payment
  collection**: this ticket builds the integration *point* only. The kiosk cannot process real
  money today and will not be able to until the owner activates real Click/Payme merchant
  credentials — same blocker as the rest of this codebase's ecommerce/POS payment work. Do not
  close this ticket as "payment works" based on a sandbox/test credential.

### Blocking wait screen — backend support (SPEC "Qoldiq tavakkal", MUST — this is the risk
mitigation half this ticket owns; SC-4 owns the staff-facing half)
- [ ] `GET /api/v1/kiosk/order/{sale_id}` returns current status (`awaiting_payment` /
  `paid` / `payment_failed` / `cancelled`) for the frontend to poll
- [ ] This endpoint's contract must support a client-side ~90 second polling loop with a clear
  terminal "give up, go talk to staff" signal — document the exact status value/response shape
  the frontend (SC-5) should treat as "stop polling, show staff-escalation message" (do not
  leave this undefined and force SC-5 to guess)
- [ ] **Acceptance test, not optional**: a sale that never reaches `paid` stays in
  `awaiting_payment` indefinitely on the backend — nothing auto-marks it "paid" after a timeout.
  The timeout is a *frontend* UX behavior (stop polling, show a message); it must never become a
  backend auto-confirm. Write a test asserting this explicitly (`test_kiosk_checkout.py::
  test_unpaid_order_never_auto_confirms_after_timeout`).

---

## Technical Notes

- **Antipattern**: do not attempt to fix the stock-before-payment ordering inside
  `create_sale_core()` itself. SPEC explicitly rejected pre-authorization/stock-hold as
  out-of-scope cross-cutting work (it would change semantics for 3 other callers: staff POS, B2B,
  B2C). This ticket's job is to make the *symptom* safe (don't tell the customer to leave), not
  to fix the underlying ordering.
- `max_cart_amount` default value is an open question the owner hasn't answered yet (SPEC "Ochiq
  savollar" #2). Implement the setting as nullable/unlimited by default and make it trivially
  configurable — do not hardcode a guessed number as if it were a final decision.
- `requires_staff_check` column: add it, populate nothing into it, build nothing that reads it.
  It's explicitly reserved for a future sprint per SPEC's QILMAYMIZ list — resist the urge to
  wire up "while I'm here" logic for it.

---

## Definition of Done

- [ ] Mechanical: `pytest apps/api/tests/test_kiosk_checkout.py -v` — 0 fail, including the
  "never auto-confirms" test above
- [ ] Mechanical: regression — existing `sale/service.py` tests (staff POS, B2B, B2C paths)
  unaffected
- [ ] Agentic: qa-reviewer BLOCKER yo'q — reviewer must specifically confirm the cart-limit
  check runs *before* `create_sale_core()`, and that client-sent price is never used
- [ ] Behavioral: Postman — scan 3 products, checkout with Click/Payme disabled → `201`,
  `payment.mode="unavailable"`, sale sits in `awaiting_payment`; poll `GET /kiosk/order/{id}`
  confirms status never flips to `paid` on its own
- [ ] Human-gate: merge
