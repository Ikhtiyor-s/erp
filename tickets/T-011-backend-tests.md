# T-011 — Backend Tests: Warehouse Rebuild Coverage

## Goal
Write pytest test cases covering the critical paths of the new warehouse endpoints: transfers, requests, stock validation, and import/export.

## Owner Role
`backend-dev`

## Depends On
`T-004`, `T-005`, `T-006`

## Estimated Size
M

## Files Likely Touched
- `apps/api/tests/test_warehouse_types.py` — new file
- `apps/api/tests/test_warehouse_transfers.py` — new file
- `apps/api/tests/test_warehouse_requests.py` — new file
- `apps/api/tests/test_warehouse_excel.py` — new file

## Test Cases Required

### test_warehouse_types.py
- `test_create_type_success` — POST creates type, returns id.
- `test_create_type_duplicate_name` — second POST same name → 409 or DB unique error handled gracefully.
- `test_list_types_org_isolation` — org A types not visible to org B.

### test_warehouse_transfers.py
- `test_transfer_full_workflow` — create draft → send → receive; verify stock moved.
- `test_transfer_send_insufficient_stock` — send when qty > on_hand → 422.
- `test_transfer_cancel_sent_reverses_stock` — cancel after send; verify source stock restored.
- `test_transfer_cannot_cancel_received` — cancel received → 409.
- `test_transfer_same_warehouse_rejected` — from_warehouse == to_warehouse → 422.

### test_warehouse_requests.py
- `test_request_create_valid` — qty <= on_hand → 201.
- `test_request_create_exceeds_stock` → 422 with product name in message.
- `test_request_approve` — pending → approved; approved_by set.
- `test_request_qty_on_hand_snapshot` — on_hand in items table matches stock at creation time.

### test_warehouse_excel.py
- `test_import_valid_file` — upload 5-row xlsx; response `{created: 5, updated: 0, errors: []}`.
- `test_import_idempotent` — upload same file twice; second time `updated: 5`.
- `test_import_bad_price_row` — one row with non-numeric price; errors contains that row, others processed.
- `test_export_returns_xlsx` — GET /export; Content-Type correct; file non-empty.

## Acceptance Criteria
- [ ] `docker exec erp-api pytest apps/api/tests/ -v` → 0 failures, all new tests collected and passing.
- [ ] No test shares state (each uses its own org_id / clean fixtures).
- [ ] Tests do not make external network calls.

## How We'll Know It's Done
`pytest` output: `N passed` with zero failures or errors. Transfer stock math verified by asserting `stock_balances` rows in test DB.
