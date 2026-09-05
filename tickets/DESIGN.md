# DESIGN.md — Warehouse Module Rebuild (Sprint W1)

_Architect: claude-sonnet-4-6 | Date: 2026-08-26 | Status: FROZEN_

---

## Executive Summary

The warehouse module (`apps/api/app/modules/warehouse/router.py`, 990 lines, no service layer) is
extended — not rewritten — by appending new route sections. The existing `_stock_apply` helper
(lines 23-46) is kept signature-compatible but gains an `idempotency_key` parameter for transfer
safety. `doc_number` sequential generation uses **Variant B** (a `document_sequences` counter table
with `SELECT … FOR UPDATE`): safer than advisory locks under high concurrency, backup-friendly, and
requires no DB-level sequence objects per org. Six `.corrupted` frontend stubs are replaced by
working pages; the three surviving working pages (revision, recommended-stock, write-off family)
are untouched. All new frontend pages follow the project's existing `useState` + `api.ts` axios
pattern — no new state library introduced.

---

## Stack

No new dependencies are introduced. All items below are already present in the project.

| Layer | Technology | Version (existing) |
|---|---|---|
| Backend | FastAPI 0.115 + SQLAlchemy 2.0 async + asyncpg | pinned |
| Validation | Pydantic v2 | pinned |
| Excel | openpyxl | 3.1.5 (already in requirements.txt) |
| Auth / multi-tenant | JWT + `get_current_org_id` dep | existing |
| RBAC | `require_permission` dep + `permissions.py` | existing |
| Frontend | Next.js 15 App Router + TypeScript + Tailwind | pinned |
| i18n | next-intl | existing |
| HTTP client | axios via `@/lib/api` | existing |
| Toasts | sonner | existing |
| Icons | lucide-react | existing |

---

## File / Folder Layout

```
apps/api/app/
  db/
    schema_patches.py              # APPEND new PATCHES entries (T-001)
  modules/
    rbac/
      permissions.py               # APPEND 13 new permission codes (T-002)
    warehouse/
      router.py                    # APPEND new sections; existing code untouched
      service.py                   # NEW — extracted helpers: _stock_apply, _stock_qty,
                                   #   _next_doc_number; imported by router.py
  tests/
    test_warehouse_transfer.py     # NEW (T-011)
    test_warehouse_request.py      # NEW (T-011)
    test_warehouse_types.py        # NEW (T-011)

apps/web/app/(dashboard)/warehouse/
  types/
    page.tsx                       # REBUILD (T-007)
  [wid]/
    rows/
      page.tsx                     # NEW (T-007)
      [rid]/
        racks/
          page.tsx                 # NEW (T-007)
  internal-transfers/
    page.tsx                       # REBUILD (T-008)
  requests/
    page.tsx                       # NEW (T-009)
  products/
    page.tsx                       # ENHANCE: add product_type, rack picker,
                                   #          import/export buttons (T-010)
  warehouses/
    page.tsx                       # ENHANCE: add type_id selector (T-007)

apps/web/
  lib/
    menu.config.ts                 # ADD entries for types, requests (T-007, T-009)
  i18n/messages/
    uz.json                        # ADD warehouse.* keys (T-007,008,009,010)
    ru.json
    en.json
    uz-cyrl.json

# Files to DELETE (T-003):
apps/web/app/(dashboard)/warehouse/types/page.tsx.corrupted
apps/web/app/(dashboard)/warehouse/internal-transfers/page.tsx.corrupted
apps/web/app/(dashboard)/warehouse/write-off/page.tsx.corrupted
apps/web/app/(dashboard)/warehouse/write-off-reason/page.tsx.corrupted
apps/web/app/(dashboard)/warehouse/revision/page.tsx.corrupted
apps/web/app/(dashboard)/warehouse/recommended-stock/page.tsx.corrupted
```

---

## Section: `_stock_apply` Contract

### Current State (router.py lines 23–46)

```python
async def _stock_apply(
    db: AsyncSession,
    warehouse_id: int,
    product_id: str,
    delta_qty: Decimal,
    cost: Decimal | None = None,   # only used when delta_qty > 0
) -> None:
```

Returns `None`. Does not guard against negative resulting stock. Called by:

| Caller | Location | How |
|---|---|---|
| `finish_inventory` | line 533 | `_stock_apply(db, wh, pid, diff_qty)` — no cost |
| `create_transfer` (OLD, pre-sprint) | line 610, 612 | deduct + credit in same call |
| `create_write_off` | line 773 | `_stock_apply(db, wh, pid, -qty)` — no cost |

### Problems for T-005

1. The old `create_transfer` (lines 579-615) does both deduction and credit in one atomic call with
   no status machine — it writes `status='received'` immediately. T-005 introduces a two-step
   workflow (`send` deducts, `receive` credits). The old `/transfers` endpoint remains registered
   on the router for backwards compatibility but MUST NOT conflict with new `/warehouse/transfers`.
   **Resolution**: The old code is under path `/warehouse/transfers` (same prefix). The NEW
   `internal_transfers` endpoints use the SAME path prefix but target a DIFFERENT table
   (`internal_transfers`, not `transfers`). Both can coexist in `router.py` because FastAPI matches
   by path; the old `GET /warehouse/transfers` and the new `GET /warehouse/transfers` would
   conflict. See Migration Steps below.

2. No idempotency guard: calling `receive` twice would double-credit destination stock.

3. No "insufficient stock" error — `_stock_apply` with a negative delta can produce negative
   `quantity` silently.

### New Signature (to be defined in `service.py`)

```python
async def _stock_apply(
    db: AsyncSession,
    warehouse_id: int,
    product_id: str,
    delta_qty: Decimal,
    cost: Decimal | None = None,
    *,
    allow_negative: bool = False,   # write-off/inventory may produce negative; transfer MUST NOT
) -> None:
    """
    Apply +/- delta to stock_balances within the caller's transaction.
    Raises HTTPException(422) if allow_negative=False and resulting qty < 0.
    Callers MUST NOT commit inside this function; commit belongs to the caller.
    """
    if delta_qty == 0:
        return
    if not allow_negative and delta_qty < 0:
        # Pre-check current balance before applying
        current = await _stock_qty(db, warehouse_id, product_id)
        if current + delta_qty < 0:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Insufficient stock: warehouse={warehouse_id} "
                       f"product={product_id} on_hand={current} requested={-delta_qty}",
            )
    # ... existing UPSERT logic unchanged ...
```

The existing SQL body (lines 29-46) is copied verbatim into `service.py`. The `allow_negative`
parameter defaults to `False` so all new callers (transfer `send`) are protected by default.

**Idempotency for transfer receive**: The `receive` endpoint MUST check `status == 'sent'` before
applying stock. The status update and stock apply happen inside the same DB transaction (no commit
between them). If `receive` is called twice, the second call finds `status == 'received'` and
returns HTTP 409 before touching stock. This is the idempotency guard — no separate idempotency
key table is needed.

**Transaction boundary for transfer send**: The `send` endpoint MUST:
1. Lock the transfer row with `SELECT … FOR UPDATE` to prevent concurrent send.
2. In a single transaction: validate all item qtys, apply all deductions via `_stock_apply`,
   update transfer status, set `sent_at` / `sent_by`.
3. `await db.commit()` once, after all applies.

If any `_stock_apply` raises 422 (insufficient stock for any line), the transaction is rolled back
automatically (the exception propagates before commit). No partial deduction occurs.

### Migration Steps for Existing Callers

| Caller | Action |
|---|---|
| `finish_inventory` (line 533) | Import `_stock_apply` from `service.py`; add `allow_negative=True` (inventory diff can be negative) |
| `create_write_off` (line 773) | Import from `service.py`; add `allow_negative=True` (write-off always negative delta) |
| OLD `create_transfer` (line 579) | **Rename path to `/warehouse/transfers/legacy`** OR remove entirely if no frontend uses it. The existing `internal-transfers/page.tsx` was `.corrupted` — no live frontend calls it. Safe to **remove** the old route section and replace with new `internal_transfers` routes. |

### Old vs New Route Disambiguation

The old `router.py` has:
- `GET /warehouse/transfers` → reads `transfers` table
- `POST /warehouse/transfers` → writes to `transfers` table, immediate deduct+credit

The new T-005 introduces:
- `GET /warehouse/transfers` → reads `internal_transfers` table (different table, same path)
- `POST /warehouse/transfers` → creates draft in `internal_transfers` table

**Decision**: Remove old `GET/POST /warehouse/transfers` and `GET /warehouse/transfers/{tid}`
sections (lines 561-638) entirely. The `transfers` table is legacy; no working frontend called it
(the page was `.corrupted`). Backend-dev MUST confirm no sale/finance module imports or calls
`/warehouse/transfers` before deletion. If found, rename old routes to `/warehouse/transfers/old`
and flag in QUESTIONS.md.

### Test Coverage Requirements

- `test_warehouse_transfer.py`: create → send (stock deducted) → receive (stock credited) → attempt
  second receive returns 409.
- `test_warehouse_transfer.py`: send with qty > on_hand returns 422 with product name in detail.
- `test_warehouse_transfer.py`: cancel a `sent` transfer re-credits source stock.
- `test_warehouse_request.py`: create request with qty > on_hand returns 422.
- `test_warehouse_request.py`: `qty_on_hand` snapshot in `product_request_items` matches live stock
  at creation time.

---

## Section: `doc_number` Locking

### Decision: Variant B — `document_sequences` Counter Table with SELECT … FOR UPDATE

**Rationale:**

- **Variant A (advisory lock)**: `pg_advisory_xact_lock` releases at transaction end, so it
  works per-transaction. However, advisory lock keys are integers; hashing `org_id + doc_type`
  risks collision across orgs (unlikely but non-zero). Harder to audit ("why is this lock held?")
  and invisible in `pg_stat_activity` without custom tooling.

- **Variant B (counter row + FOR UPDATE)**: Explicit row lock on a known primary key. Zero
  collision risk. The counter row is visible in the DB, trivially auditable, and survives
  `pg_dump` / restore correctly. Works in any replication topology where writes go to primary.
  Slightly more SQL but the pattern is standard and understood by all SQL developers.

- **Variant C (one sequence per org+type)**: Postgres sequences are non-transactional (no
  rollback), so a failed transfer creation wastes a sequence number (gaps). Also, creating a new
  sequence per org is a DDL operation requiring elevated privileges and scales poorly (each new
  org adds DDL). Rejected.

### Table Schema

```sql
-- Add to schema_patches.py (T-001)
CREATE TABLE IF NOT EXISTS document_sequences (
    organization_id  UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    doc_type         VARCHAR(20) NOT NULL,   -- 'transfer' | 'request'
    next_value       INT         NOT NULL DEFAULT 1,
    PRIMARY KEY (organization_id, doc_type)
);
```

No index needed beyond the composite PK.

### Usage Pattern in `service.py`

```python
async def _next_doc_number(
    db: AsyncSession,
    org_id: str,
    doc_type: str,          # 'transfer' | 'request'
    prefix: str,            # 'TRF' | 'REQ'
) -> str:
    """
    Atomically increments the per-org counter and returns a formatted doc number.
    MUST be called inside the same transaction that creates the document row.
    The FOR UPDATE lock is released when that transaction commits.
    """
    year = datetime.utcnow().year
    # Upsert to ensure the row exists, then lock it
    await db.execute(
        text("""
            INSERT INTO document_sequences (organization_id, doc_type, next_value)
            VALUES (:o, :t, 1)
            ON CONFLICT (organization_id, doc_type) DO NOTHING
        """),
        {"o": org_id, "t": doc_type},
    )
    res = await db.execute(
        text("""
            SELECT next_value FROM document_sequences
            WHERE organization_id = :o AND doc_type = :t
            FOR UPDATE
        """),
        {"o": org_id, "t": doc_type},
    )
    n = res.scalar()
    await db.execute(
        text("""
            UPDATE document_sequences SET next_value = next_value + 1
            WHERE organization_id = :o AND doc_type = :t
        """),
        {"o": org_id, "t": doc_type},
    )
    return f"{prefix}-{year}-{n:05d}"
```

**Example output**: `TRF-2026-00001`, `REQ-2026-00003`.

The counter is NOT reset per year. Year is embedded in the doc_number string but the
`next_value` counter is cumulative. If year-scoped reset is needed in a future sprint, add a
`year` column to the PK — this is a non-breaking additive migration.

**Concurrent safety**: Two concurrent `POST /warehouse/transfers` for the same org will race on
the `SELECT … FOR UPDATE`. The second request blocks until the first transaction commits. After
commit, the second sees `next_value` already incremented and proceeds. No duplicate numbers are
possible.

---

## Section: Foreign Key Graph

```
organizations
    │
    ├──< warehouse_types (organization_id)
    │       └──< warehouses.type_id  →  warehouse_types.id
    │
    ├──< warehouses (organization_id)
    │       └──< warehouse_rows (warehouse_id → warehouses.id)
    │               └──< warehouse_racks (row_id → warehouse_rows.id)
    │                       └── products.default_rack_id → warehouse_racks.id
    │
    ├──< products (organization_id)
    │       ├── products.default_rack_id → warehouse_racks.id  (nullable)
    │       └── products.product_type  VARCHAR(100)  (no FK, free text this sprint)
    │
    ├──< internal_transfers (organization_id)
    │       ├── from_warehouse → warehouses.id
    │       ├── to_warehouse   → warehouses.id
    │       ├── sent_by        → users.id  (nullable)
    │       ├── received_by    → users.id  (nullable)
    │       ├── created_by     → users.id  (nullable)
    │       └──< internal_transfer_items (transfer_id)
    │               ├── product_id → products.id
    │               └── unit_id    → product_units.id  (nullable)
    │
    ├──< product_requests (organization_id)
    │       ├── from_warehouse → warehouses.id
    │       ├── to_warehouse   → warehouses.id  (nullable)
    │       ├── requested_by   → users.id  (nullable)
    │       ├── approved_by    → users.id  (nullable)
    │       └──< product_request_items (request_id)
    │               ├── product_id  → products.id
    │               └── category_id → product_categories.id  (nullable)
    │
    └──< document_sequences (organization_id)
            PK: (organization_id, doc_type)
```

**Notes:**
- `rack_id` is NOT added to `stock_balances` this sprint (explicit WON'T DO in SPEC).
- `internal_transfer_items.unit_id` references `product_units` per SPEC DDL; existing table name
  in the schema is `units` (seen in `list_products` JOIN). Backend-dev MUST verify the actual
  table name with `\d product_units` before writing the FK. If the table is named `units`,
  change the FK accordingly or omit it — the field is nullable.

---

## Section: Frontend ↔ Backend API Contract (FROZEN)

All paths are prefixed `/warehouse`. All requests require headers:
- `Authorization: Bearer <token>`
- `X-Organization-Id: <org_uuid>`

All datetimes are ISO 8601 strings. All IDs are strings in JSON (UUIDs as strings, integers as
numbers unless noted). All error responses follow `{"detail": "<message>"}`.

---

### Warehouse Types (T-004 / T-007)

#### GET /warehouse/types

Response `200`:
```json
[
  {
    "id": 1,
    "name": "Markaziy ombor",
    "code": "central",
    "is_active": true,
    "created_at": "2026-08-26T10:00:00Z"
  }
]
```

#### POST /warehouse/types

Request:
```json
{ "name": "Savdo nuqtasi", "code": "pos" }
```
`code` MUST be one of: `central | pos | transit | scrap | custom`. Field is optional (nullable).

Response `201`:
```json
{ "id": 2 }
```

Errors: `422` validation, `409` if `(organization_id, name)` already exists.

#### PUT /warehouse/types/{id}

Request: same shape as POST.
Response `200`: `{ "ok": true }`
Errors: `404` if not found in org.

#### DELETE /warehouse/types/{id}

Response `200`: `{ "ok": true }` (soft-delete: `is_active = FALSE`)

---

### Warehouse Rows (T-004 / T-007)

#### GET /warehouse/{wid}/rows

Response `200`:
```json
[
  {
    "id": 1,
    "warehouse_id": 3,
    "name": "A qator",
    "sort_order": 0,
    "rack_count": 5
  }
]
```
`rack_count` is computed via subquery COUNT on `warehouse_racks`.

Errors: `404` if `wid` not in org.

#### POST /warehouse/{wid}/rows

Request:
```json
{ "name": "B qator", "sort_order": 1 }
```
Response `201`: `{ "id": 2 }`
Errors: `404` if warehouse not in org.

#### PUT /warehouse/rows/{rid}

Request: `{ "name": "B qator (yangi)", "sort_order": 2 }`
Response `200`: `{ "ok": true }`
Errors: `404`.

#### DELETE /warehouse/rows/{rid}

Response `200`: `{ "ok": true }`
Errors: `404`, `409 {"detail": "Bu qatorda stellajlar mavjud"}` if racks exist.

---

### Warehouse Racks (T-004 / T-007)

#### GET /warehouse/rows/{rid}/racks

Response `200`:
```json
[
  { "id": 1, "row_id": 1, "name": "A-1", "sort_order": 0 }
]
```

#### POST /warehouse/rows/{rid}/racks

Request: `{ "name": "A-2", "sort_order": 1 }`
Response `201`: `{ "id": 2 }`

#### PUT /warehouse/racks/{rack_id}

Request: `{ "name": "A-2 (yangilandi)", "sort_order": 2 }`
Response `200`: `{ "ok": true }`

#### DELETE /warehouse/racks/{rack_id}

Response `200`: `{ "ok": true }`
Errors: `409 {"detail": "Bu stellajga mahsulot bog'langan"}` if any `products.default_rack_id` references it.

---

### Warehouse Enhancements (T-004 / T-007)

#### GET /warehouse/warehouses (enhanced)

Each object now includes:
```json
{
  "id": 1,
  "name": "Asosiy ombor",
  "address": "Toshkent",
  "responsible_id": null,
  "responsible_name": null,
  "type_id": 1,
  "type_name": "Markaziy ombor",
  "product_count": 42,
  "stock_value": "15000000.00"
}
```
`type_id` and `type_name` are nullable (LEFT JOIN).

#### POST /warehouse/warehouses (enhanced)

Request now accepts optional `type_id`:
```json
{ "name": "Yangi ombor", "address": null, "responsible_id": null, "type_id": 1 }
```

#### PUT /warehouse/warehouses/{wid} (enhanced)

Same as POST shape.

---

### Internal Transfers (T-005 / T-008)

#### GET /warehouse/transfers

Query params: `status` (optional, one of `draft|sent|received|cancelled`),
`from_warehouse` (int, optional), `to_warehouse` (int, optional),
`page` (int default 1), `limit` (int default 50 max 200).

Response `200`:
```json
{
  "items": [
    {
      "id": "uuid",
      "doc_number": "TRF-2026-00001",
      "from_warehouse": 1,
      "from_name": "Asosiy ombor",
      "to_warehouse": 2,
      "to_name": "Savdo nuqtasi",
      "status": "sent",
      "item_count": 3,
      "created_by_name": "Alisher Karimov",
      "created_at": "2026-08-26T09:00:00Z",
      "sent_at": "2026-08-26T10:00:00Z",
      "received_at": null
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 50
}
```

#### POST /warehouse/transfers

Creates a `draft` transfer. Does NOT touch stock.

Request:
```json
{
  "from_warehouse": 1,
  "to_warehouse": 2,
  "notes": "Ixtiyoriy izoh",
  "items": [
    { "product_id": "uuid", "qty": "10.0000", "unit_id": null }
  ]
}
```

Validations (server-side, return `422`):
- `from_warehouse != to_warehouse`
- Both warehouses MUST belong to org
- `items` MUST NOT be empty

Response `201`:
```json
{ "id": "uuid", "doc_number": "TRF-2026-00001" }
```

#### GET /warehouse/transfers/{id}

Response `200`:
```json
{
  "id": "uuid",
  "doc_number": "TRF-2026-00001",
  "from_warehouse": 1,
  "from_name": "Asosiy ombor",
  "to_warehouse": 2,
  "to_name": "Savdo nuqtasi",
  "status": "draft",
  "notes": null,
  "created_at": "2026-08-26T09:00:00Z",
  "sent_at": null,
  "received_at": null,
  "sent_by": null,
  "received_by": null,
  "items": [
    {
      "product_id": "uuid",
      "product_name": "Mahsulot A",
      "qty": "10.0000",
      "unit_id": null,
      "unit_name": null
    }
  ]
}
```

#### POST /warehouse/transfers/{id}/send

Permission required: `warehouse.transfer.send`

No request body.

Behavior:
- Verifies `status == 'draft'`; else `409 {"detail": "Faqat draft holat yuborilishi mumkin"}`
- For each item: checks `on_hand >= qty`; if any fails → `422 {"detail": "{product_name}: mavjud {on_hand}, kerak {qty}"}`
- All stock checks MUST pass before any `_stock_apply` call (check all lines first, then apply all)
- Applies `_stock_apply(db, from_warehouse, product_id, -qty, allow_negative=False)` for each item
- Updates `status='sent'`, `sent_at=NOW()`, `sent_by=<user_id>`
- Single `db.commit()`

Response `200`: `{ "ok": true }`

#### POST /warehouse/transfers/{id}/receive

Permission required: `warehouse.transfer.receive`

No request body.

Behavior:
- Verifies `status == 'sent'`; else `409`
- For each item: reads `avg_cost` from `stock_balances` at `from_warehouse` (snapshot stored at
  send time is NOT available; instead use the item cost stored in `internal_transfer_items` if
  a `cost` column is added, OR re-read from source balance)

  **Decision**: Add column `cost NUMERIC(20,4) DEFAULT 0` to `internal_transfer_items`. Backend
  populates it at `send` time (reads `avg_cost` from source balance before deducting). At
  `receive` time, reads `cost` from the item row. This avoids re-reading source balance after
  deduction (which would give wrong avg_cost).

  Add to T-001 schema: `ALTER TABLE internal_transfer_items ADD COLUMN IF NOT EXISTS cost NUMERIC(20,4) DEFAULT 0;`

- Applies `_stock_apply(db, to_warehouse, product_id, +qty, cost=item.cost)` for each item
- Updates `status='received'`, `received_at=NOW()`, `received_by=<user_id>`
- Single `db.commit()`

Response `200`: `{ "ok": true }`

#### POST /warehouse/transfers/{id}/cancel

Permission required: `warehouse.transfer.cancel` (for sent→cancelled); any transfer.send holder
can cancel draft.

Behavior:
- `received` → `409 {"detail": "Qabul qilingan o'tkazmani bekor qilib bo'lmaydi"}`
- `draft` → `cancelled`: no stock change
- `sent` → `cancelled`: re-credits source stock with `_stock_apply(db, from_warehouse, product_id, +qty, allow_negative=False)`. Cost for re-credit: re-read current `avg_cost` at destination (if already credited there) — but since `sent` means destination NOT yet credited, the re-credit simply adds qty back to source. Use `cost=None` (no weighted avg recalc needed for returning goods).

Response `200`: `{ "ok": true }`

---

### Stock On-Hand (T-005 / T-009)

#### GET /warehouse/stock/on-hand

Query params: `warehouse_id` (int, required), `product_id` (UUID, optional),
`category_id` (int, optional).

Response `200`:
```json
[
  {
    "product_id": "uuid",
    "product_name": "Mahsulot A",
    "warehouse_id": 1,
    "qty": "10.0000",
    "avg_cost": "5000.00",
    "unit_name": "dona"
  }
]
```

If product exists but has no balance, returns `[{"product_id":"uuid","product_name":"...","warehouse_id":1,"qty":"0.0000","avg_cost":"0.00","unit_name":"dona"}]` — never `404`.

All rows filtered by `organization_id = :o` via JOIN on products.

---

### Product Requests (T-005 / T-009)

#### GET /warehouse/requests

Query params: `status` (optional), `from_warehouse` (int, optional),
`page` (int default 1), `limit` (int default 50 max 200).

Response `200`:
```json
{
  "items": [
    {
      "id": "uuid",
      "doc_number": "REQ-2026-00001",
      "from_warehouse": 1,
      "from_name": "Asosiy ombor",
      "to_warehouse": null,
      "to_name": null,
      "status": "pending",
      "item_count": 2,
      "requested_by_name": "Botir Yusupov",
      "created_at": "2026-08-26T11:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 50
}
```

#### POST /warehouse/requests

Permission required: `warehouse.request.create`

Request:
```json
{
  "from_warehouse": 1,
  "to_warehouse": null,
  "notes": "Ixtiyoriy",
  "items": [
    {
      "product_id": "uuid",
      "category_id": 3,
      "qty_requested": "5.0000"
    }
  ]
}
```

Validations:
- `items` MUST NOT be empty
- For each item: server reads `on_hand = _stock_qty(db, from_warehouse, product_id)`
  - If `qty_requested > on_hand` → `422 {"detail": "{product_name}: mavjud {on_hand}, so'rov {qty_requested}"}`
  - Stores `qty_on_hand = on_hand` snapshot in `product_request_items`

Response `201`:
```json
{ "id": "uuid", "doc_number": "REQ-2026-00001" }
```

#### POST /warehouse/requests/{id}/approve

Permission required: `warehouse.request.approve`

No body.

- `pending` → `approved`; sets `approved_by`
- Other statuses → `409`

Response `200`: `{ "ok": true }`

#### POST /warehouse/requests/{id}/reject

Permission required: `warehouse.request.approve`

No body.

- `pending` → `rejected`; sets `approved_by` (the rejecting actor)
- Other statuses → `409`

Response `200`: `{ "ok": true }`

---

### Excel Import / Export (T-006 / T-010)

#### POST /warehouse/products/import

Permission required: `warehouse.product.import`

Content-Type: `multipart/form-data`, field name: `file` (`.xlsx`).

Response `200`:
```json
{
  "created": 10,
  "updated": 3,
  "errors": [
    { "row": 5, "message": "Kategoriya topilmadi: Noma'lum" },
    { "row": 9, "message": "purchase_price raqam emas: 'arzon'" }
  ]
}
```

Row errors do NOT roll back other rows (row-by-row commit per spec assumption).

#### GET /warehouse/products/export

Permission required: `warehouse.product.export`

Query params: `warehouse_id` (int, optional), `category_id` (int, optional).

Response `200`:
- Content-Type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- Content-Disposition: `attachment; filename="products-export-{YYYY-MM-DD}.xlsx"`

Frontend: `window.open(api.defaults.baseURL + '/warehouse/products/export?...')` OR use axios
blob response and trigger download via `URL.createObjectURL`. Do NOT generate xlsx client-side.

---

## Data Shapes (Pydantic Models — backend `router.py` / `service.py`)

```python
# Warehouse Types
class WarehouseTypeIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    code: str | None = Field(None, pattern=r'^(central|pos|transit|scrap|custom)$')

# Rows
class WarehouseRowIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    sort_order: int = 0

# Racks
class WarehouseRackIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    sort_order: int = 0

# Internal Transfer Create
class InternalTransferItemIn(BaseModel):
    product_id: UUID
    qty: Decimal = Field(gt=0)
    unit_id: int | None = None

class InternalTransferIn(BaseModel):
    from_warehouse: int
    to_warehouse: int
    notes: str | None = None
    items: list[InternalTransferItemIn] = Field(min_length=1)

# Product Request Create
class ProductRequestItemIn(BaseModel):
    product_id: UUID
    category_id: int | None = None
    qty_requested: Decimal = Field(gt=0)

class ProductRequestIn(BaseModel):
    from_warehouse: int
    to_warehouse: int | None = None
    notes: str | None = None
    items: list[ProductRequestItemIn] = Field(min_length=1)

# Warehouse enhanced
class WarehouseIn(BaseModel):  # replaces existing
    name: str
    address: str | None = None
    responsible_id: UUID | None = None
    type_id: int | None = None   # NEW field added
```

---

## Migration Strategy

All schema changes go through `apps/api/app/db/schema_patches.py` (APPEND to `PATCHES` list).
No Alembic migrations this sprint (explicit WON'T DO in SPEC).

Rollback SQL (manual, for disaster recovery only — not automated):

```sql
-- Rollback order (reverse FK dependency)
DROP TABLE IF EXISTS product_request_items;
DROP TABLE IF EXISTS product_requests;
DROP TABLE IF EXISTS internal_transfer_items;
DROP TABLE IF EXISTS internal_transfers;
DROP TABLE IF EXISTS document_sequences;
ALTER TABLE products DROP COLUMN IF EXISTS default_rack_id;
ALTER TABLE products DROP COLUMN IF EXISTS product_type;
DROP TABLE IF EXISTS warehouse_racks;
DROP TABLE IF EXISTS warehouse_rows;
ALTER TABLE warehouses DROP COLUMN IF EXISTS type_id;
DROP TABLE IF EXISTS warehouse_types;
```

All patches are idempotent (`IF NOT EXISTS`, `IF NOT EXISTS` on ALTER column). Running twice is safe.

---

## API Contract Verification (Backend → Frontend Trace)

| Endpoint | Backend returns | Frontend parses as | Risk |
|---|---|---|---|
| `GET /warehouse/types` | `[{id:int, name:str, code:str|null, is_active:bool, created_at:str}]` | `type WhType = {id:number; name:string; code:string\|null; is_active:boolean; created_at:string}` | None |
| `GET /warehouse/{wid}/rows` | `[{id:int, warehouse_id:int, name:str, sort_order:int, rack_count:int}]` | `type Row = {id:number; name:string; sort_order:number; rack_count:number}` | None |
| `GET /warehouse/transfers` | `{items:[...], total:int, page:int, limit:int}` | Paginated wrapper; frontend MUST destructure `.data.items` not `.data` | Frontend bug risk: old `setRows(r.data)` pattern will break. MUST use `setRows(r.data.items)`. |
| `POST /warehouse/transfers/{id}/send` | `{ok:true}` or `422 {detail:str}` | `toast.error(getErrorMessage(e, "..."))` | None |
| `GET /warehouse/stock/on-hand` | `[{product_id, qty, ...}]` (array, never 404) | Reads `r.data[0]?.qty ?? "0"` | Safe — server guarantees 0-qty row when product has no balance |
| `POST /warehouse/requests` | `{id:str, doc_number:str}` or `422` | Modal close + toast.success + list refresh | None |
| `GET /warehouse/products/export` | binary xlsx stream | `window.open(url)` or blob download | MUST pass auth header; `window.open` won't send Authorization. Use axios blob approach: `api.get('/warehouse/products/export', {params, responseType:'blob'})` then `URL.createObjectURL`. |

**Critical note on export auth**: `window.open` cannot inject the `Authorization` header. The
frontend MUST use the axios blob download pattern (responseType: 'blob') to preserve auth.

---

## Out of Scope

Per SPEC.md WON'T DO section — explicitly excluded from this design:

- **Partial transfer receipt**: No per-line receive. All-or-nothing only.
- **Rack-level stock balances**: `rack_id` is NOT added to `stock_balances`. Rack is a location
  label on `products.default_rack_id` only.
- **Barcode scanning**: No camera API, no ZXing, no QR scanner integration.
- **Multi-warehouse request fulfillment**: One `from_warehouse` per request.
- **Revision / stocktake rebuild**: `revision/page.tsx` is kept as-is; `.corrupted` file deleted only.
- **Recommended-stock rule engine**: `recommended-stock/page.tsx` kept as-is.
- **Manufacturing / semi-product / material / services pages**: Untouched.
- **Alembic migration generation**: `schema_patches.py` only.
- **Mobile PWA pages** (`/m/warehouse/*`): Desktop-only this sprint.
- **`product_requests` auto-creating `internal_transfer` on approval**: Manual step only.
- **Opening balance import creating `warehouse_income` audit record**: Direct
  `stock_balances` patch with audit note (no income record created).
- **Year-scoped `doc_number` reset**: Counter is cumulative; year appears in string only.

**Almost designed in but excluded**:
- A `cost` column on `internal_transfer_items` is added (needed for receive logic) even though
  SPEC.md DDL does not include it. This is a design-level addition required for correctness;
  it is minimal and additive. The backend-dev MUST add it to T-001 patches.
- A `document_sequences` table is added (needed for `doc_number` generation). Not in SPEC.md
  DDL but required by the SPEC's functional requirement for sequential doc numbers.

---

## Clarifications Log

_Append only. Do not edit entries above the line._

_(empty at freeze — 2026-08-26)_
