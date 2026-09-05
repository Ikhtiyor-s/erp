# T-009 — Frontend: Product Request Page (Create with Live Stock, Approve/Reject)

## Goal
Build the product request page with cascade category → product selection and real-time on-hand stock display that gates quantity input.

## Owner Role
`frontend-dev`

## Depends On
`T-005` (backend endpoints)

## Estimated Size
M

## Files Likely Touched
- `apps/web/app/(dashboard)/warehouse/requests/page.tsx` — new file
- `apps/web/lib/menu.config.ts` — add "So'rovlar" entry under warehouse group with `permission: "warehouse.request.view"`
- `apps/web/i18n/messages/{uz,ru,en,uz-cyrl}.json` — add request-related keys

## UI Specifications

### List View (`/warehouse/requests`)
- Filter tabs: Barchasi / Kutilmoqda / Tasdiqlangan / Rad etilgan / Bajarilgan.
- Table: Doc №, From Warehouse, Item Count, Status badge, Requested By, Date, Actions.
- Mobile: card view.
- "So'rov yuborish" button (permission: `warehouse.request.create`).

### CreateRequestModal

Step-by-step within a single modal:

1. **Warehouse** — select source warehouse (from where goods will come).
2. **Line items** — each line is a row with:
   a. Category dropdown (fetched once from `/warehouse/categories`).
   b. Product dropdown — filtered by `category_id` (fetched from `/warehouse/products?category_id=X`). Shows product name + product_type.
   c. On product select: call `GET /warehouse/stock/on-hand?warehouse_id=W&product_id=P`. Display inline: "Mavjud: **{qty}** {unit}". If qty = 0, show amber warning "Omborda mavjud emas".
   d. Qty input (number). Max validation client-side: qty <= on_hand. If user types more → inline error "Miqdor mavjud qoldiqdan oshib ketdi".
   e. Remove row button.
3. Add another line button.
4. Notes textarea.
5. Submit — if any line has qty > on_hand, button is disabled with tooltip.

### Row Actions
- **Pending**: "Tasdiqlash" (approve), "Rad etish" (reject) — visible only for `warehouse.request.approve` permission. Both use ConfirmDialog.
- **Others**: view only.

## Acceptance Criteria
- [ ] On product selection, on-hand qty appears within 500ms (API call, not cached stale data).
- [ ] Client-side blocks submission if any qty > on_hand.
- [ ] Server also returns 422 if qty exceeds on_hand (double guard; UI shows parsed message).
- [ ] Approving a request changes status badge to "Tasdiqlangan" in the list without full page reload.
- [ ] Category dropdown and product dropdown are linked (selecting category re-fetches products).
- [ ] Menu entry "So'rovlar" appears for users with `warehouse.request.view`.
- [ ] i18n keys complete for uz/ru/en/uz-cyrl.
- [ ] Responsive at 375/768/1280.

## How We'll Know It's Done
Create a request for 5 units of a product with 10 on hand → succeeds. Try to request 11 → blocked by UI and by server. Manager approves → status updates in list.
