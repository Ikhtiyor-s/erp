# T-033 — Frontend: Wire ProductPicker into product request form

**Owner**: frontend-dev
**Size**: S
**Depends on**: T-031, T-026-backend-warehouse-products-paginated

---

## Goal

Replace the current cascade select (category → type → product) product input in the product request form with the `ProductPicker` component; cascade filters (category, product_type) move to the picker's filter panel.

---

## Files likely touched

- `apps/web/app/(dashboard)/warehouse/product-requests/new/page.tsx` (or equivalent route) — refactor product selection section
- `apps/web/components/warehouse/ProductPicker.tsx` — import and use (from T-031)
- `apps/web/i18n/messages/uz.json`, `ru.json`, `en.json`, `uz-cyrl.json` — new keys if any

---

## Acceptance criteria

- [ ] Old cascade select (category dropdown → type dropdown → product dropdown) is removed from the form
- [ ] `ProductPicker` renders with `warehouseId` set to the requesting warehouse (or a default warehouse if the form has a warehouse field; if none, use the organization's default warehouse — document assumption in code comment)
- [ ] Category and product_type dropdowns in ProductPicker's filter panel serve the same discovery purpose as the old cascade — no net loss of filtering capability
- [ ] "Tanlangan mahsulotlar" section shows added products with quantity input and remove button; same UX pattern as T-032
- [ ] Form submit collects `{items: [{product_id, quantity, unit_id}]}` and POSTs to the existing product request endpoint; no change to the request API contract
- [ ] Responsive; no hardcoded grid widths without breakpoint prefix
- [ ] 4 i18n languages for all new strings

---

## Notes

Size is S (not M) because the form structure is simpler than the transfer form — no warehouse-change warning needed. Do not refactor the product request approval/status flow; only the item-selection section changes.
