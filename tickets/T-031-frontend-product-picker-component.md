# T-031 — Frontend: ProductPicker reusable component

**Owner**: frontend-dev
**Size**: M
**Depends on**: none (can be built with mock/prop data in Wave 1; wired to real API in Wave 3)

---

## Goal

Build a reusable `ProductPicker` component that renders a paginated, filterable product table with on-hand stock quantities; used in both the internal transfer form and the product request form.

---

## Files likely touched

- `apps/web/components/warehouse/ProductPicker.tsx` — new component
- `apps/web/i18n/messages/uz.json`, `ru.json`, `en.json`, `uz-cyrl.json` — new i18n keys

---

## Component API (props)

```ts
interface ProductPickerProps {
  warehouseId: string               // required; drives on_hand query
  onAdd: (item: PickerItem) => void // called when "+ Qo'shish" is clicked
  selectedIds?: string[]            // highlight / disable already-selected products
}

interface PickerItem {
  productId: string
  productName: string
  unitId: string
  unitName: string
  onHand: number
}
```

---

## Acceptance criteria

- [ ] Component renders a filter panel above the table: free-text search (`q`), category dropdown, product_type dropdown; all three update URL query params (or local state — consistent with parent form pattern)
- [ ] Table columns: `#` (1-based row index for current page), Nomi, Model/Tur (`product_type` label), Kategoriya, Qoldiq (on_hand), Birlik, `[+ Qo'shish]` button
- [ ] Pagination: 30 rows/page; page controls at bottom; page resets to 1 on filter change
- [ ] `[+ Qo'shish]` calls `onAdd(item)`; button changes to a checkmark/disabled state if `productId` is in `selectedIds`
- [ ] Data fetched via `GET /warehouse/products?warehouse_id=&page=&limit=30&q=&category_id=&product_type=` (T-026-warehouse-products-paginated endpoint); shows skeleton loader while fetching
- [ ] Empty state shown when no products match filter
- [ ] Responsive: `hidden md:block` table + `md:hidden` card list for narrow screens; no hardcoded `grid-cols-N` without `sm:` prefix
- [ ] 4 i18n languages covered for all labels, placeholders, empty state
- [ ] Component is self-contained; it does NOT own the "Selected products" list — that is the parent form's responsibility

---

## Notes

In Wave 1 this component can be developed against a mock API hook that returns static data. In Wave 3, T-032 and T-033 wire it to the real endpoint once T-026-warehouse-products-paginated is done. Do not build the "Selected products" section inside this component — keep concerns separated.
