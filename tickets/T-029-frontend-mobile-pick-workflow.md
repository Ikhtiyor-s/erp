# T-029 — Frontend: Mobile pick workflow (app/m/orders)

**Owner**: frontend-dev
**Size**: L
**Depends on**: T-025

---

## Goal

Build the mobile pick workflow at `app/m/orders/` — order list, order detail with cell locations, "Topildi" action, and cashier contact modal.

---

## Files likely touched

- `apps/web/app/m/orders/page.tsx` — new: order list for picker
- `apps/web/app/m/orders/[id]/page.tsx` — new: order detail / pick list
- `apps/web/app/m/orders/[id]/CashierContactModal.tsx` — new: message + call modal
- `apps/web/i18n/messages/uz.json`, `ru.json`, `en.json`, `uz-cyrl.json`

---

## Acceptance criteria

### Order list (`/m/orders`)
- [ ] Shows cards (mobile-first, full-width): each card has `doc_number`, `customer_name`, `total_items` count, pick progress `n/total`, status badge (pending / in_progress / completed), created_at date
- [ ] Tapping a card navigates to `/m/orders/[id]`
- [ ] Pull-to-refresh or a "Yangilash" button re-fetches (polling every 30s is acceptable)
- [ ] Empty state shown when no active orders

### Order detail (`/m/orders/[id]`)
- [ ] Page header: doc_number, customer name, back button
- [ ] Progress summary: `{picked_count}/{total_items} topildi` text + a progress bar (fills as items are picked, `emerald` color per brand guide)
- [ ] Item list: each item shows `product_name`, `quantity + unit`, cell location string (`{warehouse} / {row} / {rack} / {cell_code}` or "Joyi belgilanmagan" if null)
- [ ] Each item has:
  - Green "Topildi" button (large, touch-friendly min 44px) — calls `PATCH /orders/{id}/items/{iid}/pick` with `{status:"picked"}`; button disables and turns gray after picked; shows checkmark icon
  - "Kassirga murojaat" button (amber/warning color) visible when item is NOT yet picked — opens `CashierContactModal`
  - If status is `not_found`: shows a red "Topilmadi" badge; "Kassirga murojaat" remains available
- [ ] Optimistic UI: button state updates immediately; reverts if API call fails with `toast.error`

### Cashier contact modal (`CashierContactModal`)
- [ ] Title: "Kassirga murojaat — {product_name}"
- [ ] Text area for message (placeholder: "Xabar yozing...")
- [ ] Two action buttons: "Xabar yuborish" (POST kind=message) and "Qo'ng'iroq qildim" (POST kind=call, body may be empty)
- [ ] On success: `toast.success("Xabar yuborildi")`, marks item as `not_found` if not already, modal closes
- [ ] Uses `<Modal>` component (focus trap built-in); does NOT use `window.confirm()`
- [ ] 4 i18n languages covered for all strings

### General
- [ ] Layout uses `app/m/layout.tsx` conventions (375-430px viewport)
- [ ] Permission guard: user must have `order.pick.view` to see list; `order.pick.execute` to tap Topildi; `order.pick.contact` to open cashier modal (hide button if missing permission)
- [ ] No hardcoded pixel widths; uses Tailwind responsive classes

---

## Notes

This is the most user-facing feature for warehouse workers. Tap targets must be large. Avoid complex nested scrolls — use a flat list. The progress bar should use `bg-emerald-500` per brand guide (emerald = success).
