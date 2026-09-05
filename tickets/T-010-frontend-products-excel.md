# T-010 — Frontend: Products Page Enhancement + Excel Import/Export UI

## Goal
Add `product_type` field and rack picker to the product form, and add Excel import (file upload) and export (download button) controls to the products page.

## Owner Role
`frontend-dev`

## Depends On
`T-006` (backend import/export endpoints), `T-004` (rack endpoints for picker)

## Estimated Size
M

## Files Likely Touched
- `apps/web/app/(dashboard)/warehouse/products/page.tsx` — enhance existing page
- `apps/web/i18n/messages/{uz,ru,en,uz-cyrl}.json` — add import/export keys

## UI Specifications

### Products Page Header Additions
- **"Export" button** (permission: `warehouse.product.export`): calls `GET /warehouse/products/export` with current filter params; triggers browser download via `a.href = URL.createObjectURL(blob)`. Show loading spinner on button while downloading.
- **"Import" button** (permission: `warehouse.product.import`): opens ImportModal.

### ImportModal
- File picker: accepts `.xlsx` only (`accept=".xlsx"`).
- "Shablon yuklab olish" link: calls `GET /warehouse/products/export` with no products (or a static template endpoint) to get the column-headed empty file. Alternative: link to a static `/warehouse-import-template.xlsx` served from Next.js `public/`.
- Upload button → `POST /warehouse/products/import` with FormData.
- Response display:
  - Success summary: "Yaratildi: N, Yangilandi: N, O'tkazib yuborildi: N"
  - Errors table (if any): Row №, Xato matni. Scrollable, max 300px height.
- Close modal only after user clicks "Yopish" (not on outside click if errors present).

### Product Form Modal Enhancements
- Add "Mahsulot turi / modeli" text field (`product_type`) — optional, VARCHAR(100).
- Add "Standart stellaj" dropdown:
  - First select Warehouse (optional), then Row (fetched by warehouse), then Rack (fetched by row).
  - Three chained dropdowns; all optional.
  - Stores `default_rack_id` on product.
- Existing fields (name, sku, barcode, category, unit, prices) unchanged.

### Products Table
- Add column "Tur" (`product_type`) between category and unit columns.
- Add column "Stellaj" (rack name if set).

## Acceptance Criteria
- [ ] Export button downloads a valid `.xlsx` file; filename includes today's date.
- [ ] Import of a 10-row template shows success summary; errors table shown for bad rows.
- [ ] Importing non-xlsx file shows toast.error "Faqat .xlsx format".
- [ ] Product form shows `product_type` input and rack cascade picker.
- [ ] Rack cascade: selecting warehouse loads rows, selecting row loads racks; resetting warehouse clears row and rack.
- [ ] Products table shows "Tur" and "Stellaj" columns.
- [ ] All new strings in i18n files.
- [ ] Import/Export buttons show permission-gated (hidden for viewer on Import).
- [ ] Responsive at 375/768/1280.

## How We'll Know It's Done
Upload the 10-row template → see "Yaratildi: 10" in modal. Open a product → set rack → save → table shows rack name. Export → open file in Excel → correct 12-column structure.
