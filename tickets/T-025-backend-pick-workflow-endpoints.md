# T-025 — Backend: Pick workflow endpoints

**Owner**: backend-dev
**Size**: M
**Depends on**: T-020, T-021

---

## Goal

Implement the pick list retrieval, item status update, and cashier contact (message/call log) endpoints for mobile pick workflow.

---

## Files likely touched

- `apps/api/app/modules/sale/router.py` (or a new `apps/api/app/modules/warehouse/pick_router.py` if sale router is too large)
- `apps/api/app/modules/warehouse/service.py` — pick progress aggregation helper

---

## Acceptance criteria

- [ ] `GET /orders/{oid}/pick` returns:
  ```json
  {
    "order_id": "...",
    "doc_number": "...",
    "customer_name": "...",
    "total_items": 10,
    "picked_count": 3,
    "not_found_count": 1,
    "items": [
      {
        "item_id": "...",
        "product_id": "...",
        "product_name": "...",
        "quantity": 2,
        "unit_name": "dona",
        "cell_code": "A-1",
        "rack_name": "Rack B",
        "row_name": "Qator 1",
        "warehouse_name": "Asosiy ombor",
        "pick_status": "pending|picked|not_found"
      }
    ]
  }
  ```
- [ ] `cell_code` and location fields come from JOIN: `products.default_cell_id → warehouse_cells → warehouse_racks → warehouse_rows → warehouses`; nullable if not assigned
- [ ] `PATCH /orders/{oid}/items/{iid}/pick` body `{status: "picked"|"not_found"}`:
  - Upserts `order_pick_items` row (INSERT ... ON CONFLICT DO UPDATE)
  - Sets `picked_by = current_user_id`, `picked_at = NOW()`
  - Returns updated item status + order-level totals
  - 404 if order or item not in org
- [ ] `GET /orders/{oid}/pick/messages` returns list of `{id, from_user_name, kind, body, created_at}` ordered by `created_at ASC`
- [ ] `POST /orders/{oid}/pick/messages` body `{kind: "message"|"call", body: string}`:
  - `body` required for `kind=message`; may be empty for `kind=call` (logs the call attempt)
  - Inserts into `order_pick_messages`
  - Returns 201 with the created row
- [ ] All endpoints: order must belong to `organization_id` (403/404 otherwise)
- [ ] `GET` endpoints: permission `order.pick.view`; `PATCH` pick: `order.pick.execute`; message POST: `order.pick.contact`
- [ ] `pytest apps/api/tests/test_pick_workflow.py` covers: pick list structure, upsert idempotency, cross-org isolation, message log
