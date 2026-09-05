# DESIGN-2 — Warehouse Sprint 2: BOM + Cells + Pick Workflow + ProductPicker

**Date**: 2026-08-26
**Author**: Architect
**Status**: FROZEN (API contract section)
**Covers**: T-020, T-021, T-022, T-024, T-025, T-026, T-027, T-028, T-029, T-030, T-031, T-032, T-033

---

## Executive Summary

Sprint 2 adds three orthogonal feature slices to the existing warehouse module: (1) BOM (bill of materials) for finished-goods composition with cycle-safe insert; (2) warehouse cells as the lowest spatial unit under racks, plus a product default-cell pointer; (3) mobile pick workflow with cashier messaging; and (4) a reusable paginated `ProductPicker` component wired to a new, warehouse-scoped product endpoint. The canonical stock source is the existing `stock_balances` table (confirmed via `service.py` and `init.sql`). All new backend code lands in `apps/api/app/modules/warehouse/`. The three architectural decisions are: **Python DFS** for cycle detection (BOM graph is bounded by org and depth ≤ 10); **`stock_balances.quantity`** as the single on_hand source via a batch LEFT JOIN (no N+1); **local state + props callback** for ProductPicker (parent form owns selection; no URL search params).

---

## Section 1 — BOM Cycle Detection (T-022)

### Decision: Variant A — Python DFS in-memory

**Rationale**: BOM graphs per org are small in practice (tens to low hundreds of nodes for SMB). The depth hard limit of 10 means the DFS traversal visits at most 10 nodes per insert. A recursive CTE adds complexity and is harder to unit-test in isolation. DFS is simpler, testable without a DB, and fast enough for this scale.

**Max depth**: 10 levels. An insertion that would create a chain deeper than 10 MUST be rejected with `422` and `detail: "BOM darajasi chegarasi oshib ketdi (max depth 10)"`.

**Self-reference**: A product where `component_product_id == parent_product_id` MUST be rejected before DFS is even invoked (fast path check).

### Validation function signature

```python
async def _bom_check_cycle(
    db: AsyncSession,
    org_id: str,
    parent_product_id: str,
    new_component_id: str,
    max_depth: int = 10,
) -> None:
    """
    Raises HTTPException(422) if adding new_component_id as a child of
    parent_product_id would create a cycle or exceed max_depth.

    Algorithm:
    1. Fast-path: if new_component_id == parent_product_id → raise immediately.
    2. Load the entire BOM graph for this org into a dict:
         adjacency: dict[str, list[str]] = {parent: [component, ...]}
       with a single SELECT WHERE organization_id = :o.
    3. DFS from new_component_id, following adjacency edges.
       If parent_product_id is reachable, it's a cycle → raise.
    4. DFS also tracks depth; if depth > max_depth → raise.
    """
```

### Error responses

| Condition | HTTP | `detail` string |
|---|---|---|
| Self-reference | 422 | `"Mahsulot o'z-o'ziga komponent bo'la olmaydi"` |
| Cycle detected | 422 | `"BOM davriy bog'liqlik aniqlandi (cycle detected)"` |
| Depth exceeded | 422 | `"BOM darajasi chegarasi oshib ketdi (max depth 10)"` |
| Duplicate component | 409 | `"Bu komponent allaqachon mavjud"` |
| Parent or component not in org | 404 | `"Mahsulot topilmadi"` |

The `422` body shape MUST be:
```json
{ "detail": "<message string>" }
```

---

## Section 2 — on_hand Canonical Source (T-025, T-026)

### Canonical source: `stock_balances.quantity`

**Confirmed from `apps/api/app/modules/warehouse/service.py`**: `_stock_qty()` reads from `stock_balances WHERE warehouse_id = :w AND product_id = :p`. The existing `service.py` and the entire existing transfer/request stack already use this table. `stock_balances` has `UNIQUE(warehouse_id, product_id)`.

**Important gap found**: `stock_balances` has **no `organization_id` column** (confirmed from `infra/postgres/init.sql`). The existing `_stock_qty` does NOT filter by org — it relies on `warehouse_id` belonging to the org (warehouses are org-scoped). This pattern MUST continue. Do NOT add `organization_id` to `stock_balances` in this sprint (see Found-Debt note below).

### Batch helper for N+1 prevention

Both T-025 (pick list) and T-026 (paginated products) MUST use a single batch query instead of calling `_stock_qty` per row.

```python
async def get_on_hand_batch(
    db: AsyncSession,
    warehouse_id: int,
    product_ids: list[str],
) -> dict[str, Decimal]:
    """
    Returns {product_id: on_hand_qty} for all requested product_ids in one query.
    Missing rows return Decimal("0"). Never returns None values.
    """
    if not product_ids:
        return {}
    res = await db.execute(
        text(
            "SELECT product_id, COALESCE(quantity, 0) AS qty "
            "FROM stock_balances "
            "WHERE warehouse_id = :w AND product_id = ANY(:ids)"
        ),
        {"w": warehouse_id, "ids": product_ids},
    )
    result = {str(r.product_id): Decimal(str(r.qty)) for r in res}
    for pid in product_ids:
        result.setdefault(pid, Decimal("0"))
    return result
```

### How T-025 uses it

`GET /orders/{oid}/pick` collects all `product_id` values from the sale items JOIN, calls `get_on_hand_batch(warehouse_id_from_sale, product_ids)`, and merges into item response. **One DB round-trip** for the entire pick list.

### How T-026 uses it

`GET /warehouse/products?warehouse_id=&...` uses a **LEFT JOIN subquery** inside the main paginated SQL, not a Python-side batch call:

```sql
SELECT p.id, p.name, p.model, p.product_type, ...,
       COALESCE(sb.quantity, 0) AS on_hand,
       wc.code AS default_cell_code
FROM products p
LEFT JOIN stock_balances sb
       ON sb.warehouse_id = :wid AND sb.product_id = p.id
LEFT JOIN warehouse_cells wc ON wc.id = p.default_cell_id
WHERE p.organization_id = :o AND p.is_active = TRUE
  [AND p.name ILIKE :q]
  [AND p.category_id = :cat]
  [AND p.product_type = :pt]
ORDER BY p.name
LIMIT :lim OFFSET :off
```

This is a single query with no N+1 risk even at 1000+ products.

### Performance note

`stock_balances` has `idx_stock_wh ON stock_balances(warehouse_id)`. For T-026's LEFT JOIN this index is used. No additional index is required for this sprint. Backend-dev MUST add a comment in the query noting the missing `(warehouse_id, product_id)` composite index for future optimization.

---

## Section 3 — ProductPicker Component Contract (T-031, T-032, T-033)

### Decision: Variant A — Local state + props callback

**Rationale**: URL search params (Variant B) would pollute the parent form's URL with picker-specific state and create complex coordination with Next.js `useSearchParams`. The component is embedded in a form, not a standalone page. Local state is idiomatic for this pattern and aligns with the existing Transfer and Request form conventions (both already use local `useState`).

### TypeScript interface

```typescript
// apps/web/components/warehouse/ProductPicker.tsx

export interface PickerItem {
  productId: string;
  productName: string;
  unitId: number;
  unitName: string;
  onHand: number;
  defaultCellCode: string | null;
}

export interface ProductPickerProps {
  /** Required. Drives on_hand query and is passed to GET /warehouse/products */
  warehouseId: number;
  /** Called when user clicks "+ Qo'shish" for a product not yet selected */
  onAdd: (item: PickerItem) => void;
  /** Product IDs already in the parent form's selection; these rows show as disabled/checkmark */
  selectedIds?: string[];
  /** Optional: restrict to single-select mode (default: multi) — not used in Sprint 2 but future-safe */
  mode?: "single" | "multi";
}
```

### State ownership

| State | Owner | Reason |
|---|---|---|
| `page`, `q`, `categoryId`, `productType` | **`ProductPicker` internal** | Pure picker concerns; parent doesn't need them |
| `items: PickerItem[]` (selected) | **Parent form** | Parent controls removal, qty input, and submission |
| `total`, `loading`, API response data | **`ProductPicker` internal** | Fetching concerns |

### Callback pattern

- `onAdd(item: PickerItem)` — called once per click of `[+ Qo'shish]`. Parent appends to its own list. Component has no `onRemove` — removal is handled in the parent's "Tanlangan mahsulotlar" section.
- `selectedIds` prop causes the matching row's button to render as a disabled checkmark (visual feedback only; product can still be in-table, just not re-addable).
- Parent MUST NOT pass a remove callback into `ProductPicker`. The component is add-only.

### Pagination and data fetching

- **Server-side pagination**: `GET /warehouse/products?warehouse_id=&page=&limit=30&q=&category_id=&product_type=`
- Default `limit=30`, hard-coded in component; page resets to 1 on any filter change.
- Component fetches on mount (when `warehouseId` is set) and on filter/page change.
- Filter debounce: `q` input MUST debounce 300ms before triggering fetch.

### Responsive behavior

- `≥ 768px`: standard `<table>` layout with columns: `#`, Nomi, Model/Tur, Kategoriya, Qoldiq, Birlik, `[+ Qo'shish]`
- `< 768px`: `md:hidden` card list; each card shows name, on_hand, unit, and `[+ Qo'shish]` button stacked vertically
- Class pattern follows project convention: `<div className="hidden md:block">` table + `<ul className="md:hidden">` cards
- No hardcoded `grid-cols-N` without `sm:` prefix anywhere in this component

---

## Section 4 — DB Schema Summary (T-020)

All new tables appended to `apps/api/app/db/schema_patches.py` PATCHES list (idempotent, `IF NOT EXISTS`).

### `product_bom`

```sql
CREATE TABLE IF NOT EXISTS product_bom (
    id                   BIGSERIAL PRIMARY KEY,
    organization_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    parent_product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    component_product_id UUID NOT NULL REFERENCES products(id),
    quantity             NUMERIC(20,4) NOT NULL CHECK (quantity > 0),
    unit_id              INT REFERENCES units(id),
    notes                TEXT,
    UNIQUE (organization_id, parent_product_id, component_product_id)
);
CREATE INDEX IF NOT EXISTS idx_product_bom_org_parent
    ON product_bom(organization_id, parent_product_id);
```

### `warehouse_cells`

```sql
CREATE TABLE IF NOT EXISTS warehouse_cells (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    rack_id         INT  NOT NULL REFERENCES warehouse_racks(id) ON DELETE CASCADE,
    code            VARCHAR(30) NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    UNIQUE (organization_id, rack_id, code)
);
CREATE INDEX IF NOT EXISTS idx_warehouse_cells_org_rack
    ON warehouse_cells(organization_id, rack_id);
```

### `order_pick_items`

```sql
-- item_id is a plain UUID (no FK) because sale_items rows may be deleted;
-- references sale_items.id logically but not enforced as FK.
CREATE TABLE IF NOT EXISTS order_pick_items (
    id              BIGSERIAL PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    order_id        UUID NOT NULL,
    item_id         UUID NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','picked','not_found')),
    picked_by       UUID REFERENCES users(id),
    picked_at       TIMESTAMPTZ,
    UNIQUE (organization_id, order_id, item_id)
);
CREATE INDEX IF NOT EXISTS idx_pick_items_org_order
    ON order_pick_items(organization_id, order_id);
```

**Note on `item_id` FK**: `sale_items.id` is `BIGSERIAL` (integer), not UUID. Backend-dev MUST verify the actual PK type of the sale items table before migration. If it is BIGINT, change `item_id` column type to `BIGINT`. The design uses UUID as a conservative placeholder; `QUESTIONS.md` entry is pre-emptively noted here.

### `order_pick_messages`

```sql
CREATE TABLE IF NOT EXISTS order_pick_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    order_id        UUID NOT NULL,
    from_user_id    UUID REFERENCES users(id),
    kind            VARCHAR(10) NOT NULL CHECK (kind IN ('message','call')),
    body            TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pick_messages_org_order
    ON order_pick_messages(organization_id, order_id);
```

### `products` column addition

```sql
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS default_cell_id UUID REFERENCES warehouse_cells(id);
```

### Rollback SQL

```sql
-- Rollback (reverse order to respect FK dependencies)
ALTER TABLE products DROP COLUMN IF EXISTS default_cell_id;
DROP TABLE IF EXISTS order_pick_messages;
DROP TABLE IF EXISTS order_pick_items;
DROP TABLE IF EXISTS warehouse_cells;
DROP TABLE IF EXISTS product_bom;
```

---

## Section 5 — API Contract (FROZEN)

**Base prefix**: `/api` (all paths below are relative)
**Auth**: Every request MUST include `Authorization: Bearer <token>` and `X-Organization-Id: <uuid>`.
**Tenant isolation**: All queries filter by `organization_id` from `Depends(get_current_org_id)`.

---

### 5.1 BOM Endpoints (T-022)

#### `GET /warehouse/products/{id}/bom`

**Permission**: `warehouse.bom.view`

**Response 200**:
```json
[
  {
    "id": 1,
    "component_product_id": "uuid",
    "component_name": "Yog'och taxta",
    "quantity": "4.0000",
    "unit_id": 1,
    "unit_name": "dona",
    "notes": null
  }
]
```

**Error 404**: `{ "detail": "Mahsulot topilmadi" }` — parent product not in org.

---

#### `POST /warehouse/products/{id}/bom`

**Permission**: `warehouse.bom.manage`

**Request body**:
```json
{
  "component_product_id": "uuid",
  "quantity": 4.0,
  "unit_id": 1,
  "notes": "optional"
}
```

**Response 201**:
```json
{
  "id": 7,
  "component_product_id": "uuid",
  "component_name": "Yog'och taxta",
  "quantity": "4.0000",
  "unit_id": 1,
  "unit_name": "dona",
  "notes": null
}
```

**Error cases**:
- `404` — parent or component product not in org
- `409` — `{ "detail": "Bu komponent allaqachon mavjud" }`
- `422` — cycle detected or depth exceeded (see Section 1 table)

---

#### `PATCH /warehouse/products/{id}/bom/{bom_id}`

**Permission**: `warehouse.bom.manage`

**Request body** (all fields optional):
```json
{
  "quantity": 5.0,
  "unit_id": 2,
  "notes": "updated"
}
```

**Response 200**: same shape as POST 201 response (full updated row).

**Error 404**: bom_id not found in org.

---

#### `DELETE /warehouse/products/{id}/bom/{bom_id}`

**Permission**: `warehouse.bom.manage`

**Response 204**: empty body.

**Error 404**: bom_id not found in org.

---

### 5.2 Warehouse Cells Endpoints (T-024)

#### `GET /warehouse/racks/{rack_id}/cells`

**Permission**: `warehouse.cell.view`

**Response 200**:
```json
[
  {
    "id": "uuid",
    "code": "A-1",
    "is_active": true
  }
]
```

**Error 404**: rack not in org.

---

#### `POST /warehouse/racks/{rack_id}/cells`

**Permission**: `warehouse.cell.manage`

**Request body**:
```json
{ "code": "A-2" }
```

**Response 201**:
```json
{ "id": "uuid", "code": "A-2", "is_active": true }
```

**Error 409**: `{ "detail": "Bu kod ushbu rackda allaqachon mavjud" }`

---

#### `PATCH /warehouse/racks/{rack_id}/cells/{cid}`

**Permission**: `warehouse.cell.manage`

**Request body** (all optional):
```json
{ "code": "A-3", "is_active": false }
```

**Response 200**:
```json
{ "id": "uuid", "code": "A-3", "is_active": false }
```

**Error 404**: cell not found in org.
**Error 409**: code conflict within same rack.

---

#### `DELETE /warehouse/racks/{rack_id}/cells/{cid}`

**Permission**: `warehouse.cell.manage`

**Response 204**: empty body. Soft-delete only (`is_active = FALSE`); does not break `products.default_cell_id` references.

---

### 5.3 Pick Workflow Endpoints (T-025)

Pick endpoints live in the sale/order router domain. Backend-dev MAY create `apps/api/app/modules/warehouse/pick_router.py` if `sale/router.py` is too large; the router MUST be included in `main.py` under `/api`.

#### `GET /orders/{oid}/pick`

**Permission**: `order.pick.view`

**Response 200**:
```json
{
  "order_id": "uuid",
  "doc_number": "SAL-2026-00042",
  "customer_name": "Alisher Karimov",
  "total_items": 5,
  "picked_count": 2,
  "not_found_count": 1,
  "items": [
    {
      "item_id": 17,
      "product_id": "uuid",
      "product_name": "Stol",
      "quantity": "2.000",
      "unit_name": "dona",
      "cell_code": "A-1",
      "rack_name": "Rack B",
      "row_name": "Qator 1",
      "warehouse_name": "Asosiy ombor",
      "pick_status": "pending"
    }
  ]
}
```

- `cell_code`, `rack_name`, `row_name`, `warehouse_name` are nullable strings (null when no cell assigned).
- `pick_status` values: `"pending"` | `"picked"` | `"not_found"`.
- `item_id` type matches `sale_items.id` PK type (MUST be verified by backend-dev; see schema note in Section 4).

**Error 404**: `{ "detail": "Buyurtma topilmadi" }` — order not in org.

---

#### `PATCH /orders/{oid}/items/{iid}/pick`

**Permission**: `order.pick.execute`

**Request body**:
```json
{ "status": "picked" }
```

`status` MUST be `"picked"` or `"not_found"`. `"pending"` is not a valid transition via this endpoint.

**Response 200**:
```json
{
  "item_id": 17,
  "pick_status": "picked",
  "picked_by": "uuid",
  "picked_at": "2026-08-26T09:15:00Z",
  "order_totals": {
    "total_items": 5,
    "picked_count": 3,
    "not_found_count": 1
  }
}
```

**Error 404**: order or item not in org.
**Error 422**: invalid status value.

---

#### `GET /orders/{oid}/pick/messages`

**Permission**: `order.pick.view`

**Response 200**:
```json
[
  {
    "id": "uuid",
    "from_user_name": "Sardor Nazarov",
    "kind": "message",
    "body": "Stol topilmadi, eski zaxirada bo'lishi mumkin",
    "created_at": "2026-08-26T09:20:00Z"
  }
]
```

Ordered by `created_at ASC`.

---

#### `POST /orders/{oid}/pick/messages`

**Permission**: `order.pick.contact`

**Request body**:
```json
{ "kind": "message", "body": "Stol topilmadi" }
```

- `kind` MUST be `"message"` or `"call"`.
- `body` MUST be non-empty when `kind == "message"`; MAY be empty or null when `kind == "call"`.

**Response 201**:
```json
{
  "id": "uuid",
  "from_user_name": "Sardor Nazarov",
  "kind": "message",
  "body": "Stol topilmadi",
  "created_at": "2026-08-26T09:20:00Z"
}
```

**Error 422**: `body` empty when `kind == "message"`.
**Error 404**: order not in org.

---

### 5.4 Paginated Products with on_hand (T-026)

#### `GET /warehouse/products`

> **Breaking change notice**: The existing `GET /warehouse/products` endpoint (T-001..T-011 era) returns a flat list without pagination and does not accept `warehouse_id`. This new spec **extends** the same path with new query parameters. The existing behavior (no `warehouse_id`) MUST remain backward compatible: when `warehouse_id` is absent, the endpoint falls back to the existing flat list behavior. When `warehouse_id` is present, the new paginated+on_hand response is returned. See Section 8 for compatibility details.

**Permission**: `warehouse.product.view` (use closest existing permission; check `permissions.py` before creating new one)

**Query parameters**:

| Param | Type | Required | Default |
|---|---|---|---|
| `warehouse_id` | int | yes (for new mode) | — |
| `page` | int | no | 1 |
| `limit` | int | no | 30 (max 100) |
| `q` | string | no | — |
| `category_id` | int | no | — |
| `product_type` | string | no | — |

**Response 200** (when `warehouse_id` present):
```json
{
  "total": 142,
  "page": 1,
  "limit": 30,
  "items": [
    {
      "id": "uuid",
      "name": "Stol",
      "sku": "ST-01",
      "model": null,
      "product_type": "finished",
      "product_type_label": "Tayyor mahsulot",
      "category_id": 5,
      "category_name": "Mebel",
      "unit_id": 1,
      "unit_name": "dona",
      "on_hand": 14.0,
      "default_cell_id": "uuid-or-null",
      "default_cell_code": "A-1"
    }
  ]
}
```

- `on_hand` is always a number (never null); 0.0 when no stock record exists.
- `default_cell_id` and `default_cell_code` are nullable.
- `product_type_label` is derived server-side from a fixed mapping (see Note below).

**product_type label mapping** (backend MUST implement):
```python
PRODUCT_TYPE_LABELS = {
    "finished": "Tayyor mahsulot",
    "raw": "Xom ashyo",
    "semi": "Yarim tayyor",
    "service": "Xizmat",
    None: "",
}
```

**Error 422**: `warehouse_id` missing (when caller passes `page` or `limit` without `warehouse_id`).

---

### 5.5 Acceptance criteria cross-check

| Frontend model field | Backend JSON field | Type match |
|---|---|---|
| `PickerItem.productId` | `items[].id` | string UUID — OK |
| `PickerItem.productName` | `items[].name` | string — OK |
| `PickerItem.unitId` | `items[].unit_id` | int — OK (typed as `number` in TS) |
| `PickerItem.unitName` | `items[].unit_name` | string — OK |
| `PickerItem.onHand` | `items[].on_hand` | number — OK |
| `PickerItem.defaultCellCode` | `items[].default_cell_code` | string\|null — OK |

---

## Section 6 — Out of Scope

The following were explicitly excluded per SPEC-2.md WON'T DO and MUST NOT be implemented in this sprint:

- **Printer management**: no `printers`, `product_printer`, `order_print_jobs` tables; no printer CRUD endpoints; no `POST /orders/{oid}/print`; no printer permission codes. The `devices` and `print_templates` tables already in `schema_patches.py` are unrelated (generic devices — not touched).
- **Product substitution**: cashier replacing a missing item with an alternative product — deferred to a separate sprint.
- **Real-time WebSocket push**: admin progress dashboard polls every 15 seconds. Code SHOULD include a `# TODO: upgrade to WebSocket` comment at the polling endpoint for future reference.
- **BOM multi-level explosion**: only one level of BOM is stored and returned. Recursive sub-assembly flattening (e.g., computing total raw material quantities across nested BOMs) is deferred.
- **Cell capacity tracking**: `max_items`, overflow alerts — not in this sprint.
- **Barcode/QR scan** on mobile pick workflow — button-only interaction this round.
- **ProductPicker** outside Transfer and Product Request forms — other forms are out of scope.
- **`product_type` as an enum in DB**: `product_type` is `VARCHAR(100)` (already in schema from Sprint 1). MUST NOT be changed to a PG ENUM in this sprint.

---

## Section 7 — Migration Compatibility (T-001..T-011 endpoints)

### Guaranteed non-breaking changes

1. `ALTER TABLE products ADD COLUMN IF NOT EXISTS default_cell_id` — nullable column; existing `GET /warehouse/products` response gains `default_cell_id: null` for all existing rows. No existing client code breaks (additive only).
2. `GET /warehouse/products` extended behavior: when `warehouse_id` is **absent**, the endpoint MUST return its current flat-list response (same shape as Sprint 1). The paginated+on_hand shape is returned only when `warehouse_id` is present. This means existing Transfer/Request form code (which calls `/warehouse/products?q=...` without `warehouse_id`) continues to work unchanged through Wave 3.
3. New tables (`product_bom`, `warehouse_cells`, `order_pick_items`, `order_pick_messages`) are net-new — no existing rows or endpoints affected.
4. New RBAC permission codes are additive — existing `ROLE_GRANTS` entries are not modified.

### Migration execution order

```
T-020 (schema) → T-021 (RBAC) → T-022, T-024, T-025, T-026 (backend) → frontend waves
```

Docker restart order: `docker compose restart api` after T-020 merge; subsequent backend tickets also require restart.

---

## Clarifications

_(none yet — append here with date if questions arise from builders)_

---

## Found Debt Log

See `tickets/FOUND-DEBT.md` for items discovered during this design pass (do not act on them in this sprint).
