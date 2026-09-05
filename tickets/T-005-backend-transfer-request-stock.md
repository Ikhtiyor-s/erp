# T-005 — Backend: Internal Transfer Workflow, Product Request, Stock On-Hand Query

## Goal
Implement the internal transfer state machine, product request creation/approval flow, and the stock on-hand query endpoint used by the request form.

## Owner Role
`backend-dev`

## Depends On
`T-001`, `T-002`

## Estimated Size
L

## Files Likely Touched
- `apps/api/app/modules/warehouse/router.py` — append new sections; reuse `_stock_apply` and `_stock_qty` helpers already in the file

## Endpoint Specifications

### Stock On-Hand Query
```
GET /warehouse/stock/on-hand
  ?warehouse_id=<int> &product_id=<uuid> [&category_id=<int>]
```
Returns: `[{product_id, product_name, warehouse_id, qty, unit_name}]`
All rows must be WHERE `organization_id = :o`.

### Internal Transfers
```
POST /warehouse/transfers
  body: {from_warehouse, to_warehouse, notes, items:[{product_id, qty, unit_id}]}
  — creates draft; doc_number auto = "TRF-{YYYY}-{NNNN zero-padded, per org}"
  — validates from_warehouse != to_warehouse
  — validates both warehouses belong to org

POST /warehouse/transfers/{id}/send
  — status draft → sent
  — for each item: verify qty <= stock at from_warehouse (else HTTP 422 with product name)
  — deduct stock from from_warehouse using _stock_apply
  — sets sent_at, sent_by

POST /warehouse/transfers/{id}/receive
  — status sent → received
  — credit stock to to_warehouse using _stock_apply(cost=avg_cost from source)
  — sets received_at, received_by

POST /warehouse/transfers/{id}/cancel
  — draft → cancelled: no stock change
  — sent → cancelled: reverse deduction from from_warehouse (re-credit)
  — received → cannot cancel (HTTP 409)
  — requires warehouse.transfer.cancel for sent cancellation

GET /warehouse/transfers
  ?status=&from_warehouse=&to_warehouse=&page=&limit=
  — returns paginated list with from/to warehouse names, item count, created_by name
```

### Product Requests
```
POST /warehouse/requests
  body: {from_warehouse, to_warehouse(optional), notes,
         items:[{product_id, category_id, qty_requested}]}
  — for each item: fetch on_hand = _stock_qty(from_warehouse, product_id)
  — if qty_requested > on_hand → HTTP 422 "{product_name}: mavjud {on_hand}, so'rov {qty_requested}"
  — store qty_on_hand snapshot in product_request_items
  — doc_number auto = "REQ-{YYYY}-{NNNN}"

POST /warehouse/requests/{id}/approve
  — pending → approved; sets approved_by; requires warehouse.request.approve

POST /warehouse/requests/{id}/reject
  — pending → rejected; sets approved_by (actor); requires warehouse.request.approve

GET /warehouse/requests
  ?status=&from_warehouse=&page=&limit=
```

## Acceptance Criteria
- [ ] Transfer send deducts stock; if insufficient stock for any item, entire send is rejected (no partial deduction).
- [ ] Transfer receive credits stock at avg_cost of source balance (not zero).
- [ ] Cancelling a `sent` transfer re-credits source stock exactly.
- [ ] Product request creation returns 422 (not 500) when requested qty exceeds on-hand.
- [ ] `qty_on_hand` in `product_request_items` is captured at creation time (snapshot), not live.
- [ ] Stock on-hand endpoint returns 0 qty row (not 404) when product exists but has no balance.
- [ ] All SELECT/UPDATE queries include `WHERE organization_id = :o` (cross-tenant check).
- [ ] Doc numbers are sequential per org (no gaps acceptable; collision-safe via `SELECT MAX + 1 FOR UPDATE` or similar).
- [ ] `docker exec erp-api pytest apps/api/tests/ -v` passes (add at minimum 3 new test cases).

## How We'll Know It's Done
Create transfer, send it (stock moves from source), receive it (stock appears at destination), verify `stock_balances` rows via psql. Attempt to request more than on-hand via API → get 422.
