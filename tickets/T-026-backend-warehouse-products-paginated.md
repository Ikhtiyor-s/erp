# T-026 — Backend: GET /warehouse/products paginated + on_hand

**Owner**: backend-dev
**Size**: M
**Depends on**: T-020, T-021

---

## Goal

Implement `GET /warehouse/products` with pagination, multi-filter support, and per-product `on_hand` quantity for a given warehouse. This endpoint is the single data source for the `ProductPicker` component used in transfer and product request forms.

---

## Files likely touched

- `apps/api/app/modules/warehouse/router.py` — new route
- `apps/api/app/modules/warehouse/service.py` — `get_products_paginated(warehouse_id, page, limit, q, category_id, product_type, org_id, db)` helper

---

## Query parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `warehouse_id` | UUID | yes | Filters on_hand to this warehouse |
| `page` | int | no (default 1) | 1-based page number |
| `limit` | int | no (default 30, max 100) | Rows per page |
| `q` | string | no | ILIKE search on `products.name` |
| `category_id` | int/UUID | no | Filter by product category |
| `product_type` | string | no | Filter by product_type enum value |

---

## Response shape

```json
{
  "total": 142,
  "page": 1,
  "limit": 30,
  "items": [
    {
      "id": "uuid",
      "name": "Stol",
      "model": "ST-01",
      "product_type": "finished",
      "product_type_label": "Tayyor mahsulot",
      "category_id": 5,
      "category_name": "Mebel",
      "unit_id": 1,
      "unit_name": "dona",
      "on_hand": 14.0,
      "default_cell_id": "uuid|null",
      "default_cell_code": "A-1|null"
    }
  ]
}
```

---

## Acceptance criteria

- [ ] Endpoint registered at `GET /warehouse/products` with `Depends(require_permission("warehouse.product.view"))` (or closest existing permission if `warehouse.product.view` already exists)
- [ ] `warehouse_id` is required; returns 422 if missing
- [ ] `on_hand` is computed from the existing inventory/stock table for the given `warehouse_id` and `organization_id`; returns 0.0 if no stock record exists (never null)
- [ ] Verify composite index `(organization_id, warehouse_id)` exists on the stock/inventory table before writing the join; document in code comment if index is missing
- [ ] `q` filter uses `ILIKE '%:q%'` with bound parameter (no f-string interpolation); triggers only if `len(q) >= 1`
- [ ] `category_id` and `product_type` are optional AND filters; combined correctly with `q`
- [ ] All results filtered by `organization_id` from `Depends(get_current_org_id)`
- [ ] `total` reflects filtered count (before pagination)
- [ ] `limit` capped at 100; `page` minimum 1
- [ ] `pytest apps/api/tests/test_warehouse_products_paginated.py` covers: basic list, q filter, category filter, product_type filter, warehouse_id validation, cross-org isolation, on_hand=0 when no stock

---

## Notes

Do NOT use `field::date` cast anywhere in this query. Use bound parameters for all user-supplied values. The `on_hand` join must use the existing inventory/stock table — check `apps/api/app/modules/warehouse/` or `apps/api/app/modules/sale/` for the canonical stock balance table before writing.
