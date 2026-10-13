# SC-4 — Staff Queue + Abandoned-Cart Cleanup (stock-before-payment risk mitigation, staff half)

**Owner Role**: backend-dev
**Depends On**: SC-3 (needs `source_type='sale_kiosk'` sales and `awaiting_payment` status to
exist before they can be filtered/cleaned up)
**Blocks**: none
**Estimated Size**: S-M (1-2 kun)
**Priority**: P0 — this is the staff-facing half of the architect's single biggest named risk
(stock leaves the building before payment confirms). Do not deprioritize this below cosmetic
kiosk-UI polish. A kiosk pilot that ships SC-3 without this ticket is shipping the risk without
its agreed mitigation.

---

## Goal

Give staff a cheap way to see kiosk sales stuck waiting on payment, and stop abandoned kiosk
carts from lingering forever. Both pieces reuse existing screens/endpoints — SPEC explicitly
calls this "cheap, handled in its own implementation ticket," not a new UI surface.

---

## Rationale

The architect's residual-risk writeup is explicit: `create_sale_core()` deducts stock at the
same moment it creates the sale row, independent of payment confirmation. For a kiosk, the
customer is standing there holding the goods when that gap opens. SPEC's accepted mitigation has
two parts — SC-3 built "don't tell the customer they can leave" (the kiosk-screen half); this
ticket builds "give staff a way to notice and clean up the ones that go wrong" (the staff half).
Per the architect's "staff-light pilot, not zero-staff" framing — this ticket is what makes
"staff-light" actually mean something operationally, instead of just being a disclaimer in a
doc nobody reads.

---

## Files Likely Touched

- `apps/api/app/modules/sale/router.py` — existing `GET /sale/sales` list endpoint: confirm/add
  support for filtering by `source_type=sale_kiosk` and `status=awaiting_payment` (SPEC: "mavjud
  `/sale/sales?status=confirmed` ro'yxatiga filtr sifatida qo'shiladi" — reuse the existing list
  endpoint, do not build a new one)
- `apps/web/app/(dashboard)/sale/sales/page.tsx` (or wherever the existing sales list UI lives)
  — add a filter/badge so staff can isolate kiosk sales awaiting payment without a new page
  (confirm exact file via Glob before editing — do not assume the path, this repo has had
  file-structure churn in `sale/`)
- `apps/api/app/core/scheduler.py` (or wherever existing background/cron jobs live — check for
  precedent before creating a new mechanism) — abandoned-cart auto-expire: a kiosk cart idle
  for N minutes (default 3, org-configurable via `app_settings['kiosk'].cart_idle_timeout_min`)
  should not block forever; SPEC scopes this as the *cart* (pre-checkout), not the sale itself —
  no backend sale row exists yet at that point, so "expire" here just means dropping client-side
  cart state server never needs to know about, UNLESS the kiosk already called `checkout` and
  is sitting in `awaiting_payment` with no activity — confirm with SC-3 owner exactly where the
  cart/sale boundary is before building this
- `apps/api/tests/test_kiosk_staff_queue.py` — new

---

## Acceptance Criteria

### Staff queue visibility (genuine, testable — not a doc-only disclaimer)
- [ ] `GET /sale/sales?status=awaiting_payment&source_type=sale_kiosk` (or equivalent existing
  query-param combination) returns kiosk sales stuck waiting on payment, visible to any staff
  role that already has `sale.view` — **no new permission required**, this reuses existing
  sale-list RBAC, it's a filter, not a new surface
- [ ] Sales list UI (or a trivial addition to it) lets staff distinguish a kiosk-origin sale from
  a staff-POS sale at a glance (e.g. a badge/column showing `source_type` and/or device name) —
  staff should not have to open each sale to find out it came from a kiosk
- [ ] Staff can cancel a stuck kiosk sale via the **existing** `POST /sales/{id}/cancel`
  endpoint (SPEC: stock is automatically restored on cancel — verify this is actually true for
  `source_type='sale_kiosk'` sales, not just the staff-POS path it was presumably built for)
- [ ] Test: create a kiosk sale, leave it `awaiting_payment`, confirm it appears in the filtered
  staff-queue query; cancel it; confirm stock is restored to the warehouse it was deducted from

### Abandoned-cart cleanup (SHOULD in SPEC, but implement it — don't skip a SHOULD silently)
- [ ] A kiosk sale that sits in `awaiting_payment` with zero payment activity for the configured
  idle window does **not** auto-cancel itself (that would contradict the "manual cancel only,
  V1 deliberately not automated" line in SPEC) — the cleanup job's job is to *surface* it to
  staff more insistently (e.g. flag/sort it to the top of the queue), not to cancel it
  automatically. Confirm this distinction explicitly in the PR description — "abandoned-cart
  cleanup" is about staff visibility, not an automated cancel/stock-restore pipeline, unless the
  owner has separately approved automating it (they have not, per SPEC).
- [ ] Idle threshold configurable via `app_settings`, default 3 minutes per SPEC

---

## Technical Notes

- **Antipattern**: do not build this as a brand-new dashboard page. SPEC is explicit that this
  is a filter on the existing `/sale/sales` list — the point is it should be cheap, because the
  owner's actual customer segment doesn't have dedicated loss-prevention staff the way REGOS's
  target market does.
- **Antipattern**: do not auto-cancel abandoned kiosk sales in this ticket. SPEC's residual-risk
  section says the cancel path stays manual "ataylab" (deliberately) in V1 — if you think
  auto-cancel is obviously better, that's a conversation for the architect/owner, not a decision
  to make silently while implementing this ticket.
- This ticket exists specifically so the architect's named risk doesn't become "a sentence in a
  doc that nobody operationalized." If time pressure forces a scope cut somewhere in this sprint,
  cut kiosk-UI polish (SC-5) before cutting this.

---

## Definition of Done

- [ ] Mechanical: `pytest apps/api/tests/test_kiosk_staff_queue.py -v` — 0 fail
- [ ] Agentic: qa-reviewer BLOCKER yo'q — reviewer must specifically confirm no auto-cancel
  logic was introduced
- [ ] Behavioral: create a kiosk sale via SC-3's checkout with payments disabled → staff opens
  existing sales list, filters/sees it as kiosk-origin + awaiting payment → cancels it → stock
  restored
- [ ] Human-gate: merge
