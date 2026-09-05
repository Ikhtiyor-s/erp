# T-006 — Backend: Excel Import and Export (openpyxl, server-side)

## Goal
Implement `POST /warehouse/products/import` (upload .xlsx, create/update products + opening balances) and `GET /warehouse/products/export` (download .xlsx with current stock).

## Owner Role
`backend-dev`

## Depends On
`T-001`, `T-002`

## Estimated Size
M

## Files Likely Touched
- `apps/api/app/modules/warehouse/router.py` — append import/export handlers
- `apps/api/requirements.txt` — no change needed; openpyxl==3.1.5 already present

## Import Endpoint Specification

```
POST /warehouse/products/import
Content-Type: multipart/form-data
Field: file (*.xlsx)
RBAC: warehouse.product.import
```

Processing logic (row by row, row 1 is header):
1. Read column mapping per SPEC template (columns A-L).
2. For each data row:
   a. Match or create `product_categories` by name (within org).
   b. Match or create `product_units` by name (within org, or use default unit).
   c. Upsert `products` on `(organization_id, name)` — create if not exists, update fields if exists.
   d. If `warehouse_name` and `opening_qty` provided: match warehouse by name within org; call `_stock_apply` only if current stock is 0 (do NOT double-add opening balance on re-import).
   e. If `rack_name` provided: attempt to match `warehouse_racks.name` within org; set `default_rack_id` if found, skip silently if not found.
   f. If any cell causes an exception: append `{row: R, message: "..."}` to errors list; continue to next row (no full rollback).
3. Return: `{created: N, updated: N, skipped: N, errors: [{row, message}]}`

## Export Endpoint Specification

```
GET /warehouse/products/export
  ?warehouse_id=<int>(optional) &category_id=<int>(optional)
Response: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="stock-export-{date}.xlsx"
RBAC: warehouse.product.export
```

Columns in export:
A: name, B: sku, C: barcode, D: category_name, E: product_type,
F: unit_name, G: purchase_price, H: sale_price,
I: warehouse_name (one row per warehouse where qty > 0), J: qty, K: avg_cost, L: rack_name

If `warehouse_id` provided: one row per product at that warehouse.
If no filter: one row per (product, warehouse) combination where qty > 0.

Use `StreamingResponse` with `io.BytesIO` — do not write temp files to disk.

## Acceptance Criteria
- [ ] Upload a valid 20-row template file → response shows `created + updated + skipped = 20`, `errors = []`.
- [ ] Upload same file again → all rows become `updated` (or `skipped`), stock NOT doubled.
- [ ] Upload file with one bad row (non-numeric price) → that row in `errors`, other rows processed.
- [ ] Upload non-xlsx file → HTTP 400 "Faqat .xlsx format qabul qilinadi".
- [ ] Export with `warehouse_id` filter returns only products with stock in that warehouse.
- [ ] Export response `Content-Type` is `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
- [ ] Export file opens correctly in Excel/LibreOffice (column headers in row 1).
- [ ] All DB operations scoped to `organization_id`.
- [ ] RBAC: viewer can export but cannot import.

## How We'll Know It's Done
Upload the template with 5 products, 2 with opening stock. `GET /warehouse/products/export?warehouse_id=X` returns a downloadable file; opening it shows exactly those 2 products with correct qty.
