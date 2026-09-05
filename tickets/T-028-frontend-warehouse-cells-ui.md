# T-028 — Frontend: Warehouse cells UI + product cell picker

**Owner**: frontend-dev
**Size**: S
**Depends on**: T-024

---

## Goal

Add cells (yacheyka) management within the rack detail view and a default cell picker on the product form.

---

## Files likely touched

- `apps/web/app/(dashboard)/warehouse/warehouses/[id]/racks/[rack_id]/page.tsx` — add Cells section (or create if it doesn't exist yet)
- `apps/web/app/(dashboard)/warehouse/products/[id]/page.tsx` — add default cell picker field
- `apps/web/i18n/messages/uz.json`, `ru.json`, `en.json`, `uz-cyrl.json`

---

## Acceptance criteria

- [ ] Rack detail page (or rack row expansion in the warehouse page) has a "Yacheykalar" section listing cells: `Kod` (e.g. "A-1"), `Faol`, edit/delete
- [ ] "Yacheyka qo'shish" button opens inline or modal form: `code` input (required); POST on save; 409 duplicate handled with `toast.error`
- [ ] Edit: PATCH to update code or toggle is_active; uses `<ConfirmDialog>` for delete
- [ ] Product form has a "Standart yacheyka" field: searchable select showing `{cell_code} — {rack_name} — {warehouse_name}`; nullable (clearable); sends `default_cell_id` on product save
- [ ] Cell location string (warehouse → row → rack → cell code) is shown as a read-only label on product detail view
- [ ] Responsive; no hardcoded grid widths without breakpoint prefix
- [ ] 4 i18n languages covered

---

## Notes

The rack detail page may not exist as a standalone route today. If it does not, add the cells section to the closest existing warehouse rack management view without creating an entirely new page route unless necessary.
