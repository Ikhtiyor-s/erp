# T-032 — Frontend: Wire ProductPicker into internal transfer form

**Owner**: frontend-dev
**Size**: M
**Depends on**: T-031, T-026-backend-warehouse-products-paginated

---

## Goal

Replace the current search-only product input in the internal transfer new form with the `ProductPicker` component; manage the "Selected products" section with quantity inputs.

---

## Files likely touched

- `apps/web/app/(dashboard)/warehouse/internal-transfers/new/page.tsx` — refactor product selection section
- `apps/web/components/warehouse/ProductPicker.tsx` — import and use (from T-031)
- `apps/web/i18n/messages/uz.json`, `ru.json`, `en.json`, `uz-cyrl.json` — new keys if any

---

## Acceptance criteria

- [ ] When source warehouse (`qayerdan`) is not yet selected, the ProductPicker area shows a placeholder: "Avval manba omborni tanlang"
- [ ] When source warehouse is selected, `ProductPicker` renders below the warehouse/destination row, passing `warehouseId` and `selectedIds` (product IDs already in the selected list)
- [ ] "Tanlangan mahsulotlar" section renders above the picker (or in a split layout) and lists each added product: row shows product name, unit, a quantity input (`> 0`, required), and a remove (X) button
- [ ] Quantity input is numeric; invalid (0 or negative) shows inline validation error and blocks form submission
- [ ] Form submit collects `{source_warehouse_id, destination_warehouse_id, items: [{product_id, quantity, unit_id}]}` and POSTs to the existing internal transfer endpoint; no change to the transfer API contract
- [ ] If source warehouse changes after products are selected, a `<ConfirmDialog>` warns "Manba ombor o'zgartirilsa tanlangan mahsulotlar o'chadi. Davom etasizmi?" — on confirm, clears selected list and re-mounts ProductPicker with new warehouse_id
- [ ] Responsive: picker table uses `hidden md:block` / `md:hidden` card list pattern; selected list is always visible
- [ ] No `window.confirm()` — use `<ConfirmDialog>`
- [ ] 4 i18n languages for all new strings

---

## Notes

The existing search input (`min 2 char`) should be fully replaced — do not leave both UIs in parallel. If the current form stores line items in local state, continue using local state; do not introduce a new state library.
