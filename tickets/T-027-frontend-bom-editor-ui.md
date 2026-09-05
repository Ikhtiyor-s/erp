# T-027 — Frontend: BOM editor UI (product detail tab)

**Owner**: frontend-dev
**Size**: M
**Depends on**: T-022

---

## Goal

Add a "BOM" tab to the product detail/edit page on desktop where admins can view and manage bill of materials components.

---

## Files likely touched

- `apps/web/app/(dashboard)/warehouse/products/[id]/page.tsx` — add BOM tab panel
- `apps/web/app/(dashboard)/warehouse/products/[id]/BomTab.tsx` — new component
- `apps/web/i18n/messages/uz.json`, `ru.json`, `en.json`, `uz-cyrl.json` — new i18n keys

---

## Acceptance criteria

- [ ] Product detail page has a "Texnik karta (BOM)" tab visible to users with `warehouse.bom.view` permission
- [ ] Tab shows a table: columns `Komponent`, `Miqdor`, `Birlik`, `Izoh`, `Amallar`
- [ ] "Komponent qo'shish" button opens a modal with: product search/select (searchable dropdown), quantity (number input > 0), unit select, notes textarea
- [ ] Save calls `POST /warehouse/products/{id}/bom`; on 422 cycle error shows `toast.error(getErrorMessage(e, "..."))` with the cycle message; on success row appears without page reload
- [ ] Each row has Edit (pencil) and Delete (trash) actions — delete uses `<ConfirmDialog>` (no `window.confirm()`)
- [ ] Edit opens same modal pre-filled; PATCH on save
- [ ] Table is responsive: `hidden md:block` table + `md:hidden` card list for narrower screens
- [ ] 4 i18n languages covered for all new strings (tab label, column headers, modal labels, error messages)
- [ ] No hardcoded `grid-cols-N` without `sm:` prefix

---

## Notes

If the product detail page does not yet use a tab layout, introduce one using existing UI conventions (`components/ui/`). Do not refactor unrelated parts of the product page. No printer-related fields on this page.
