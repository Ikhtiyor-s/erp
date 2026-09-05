# SPEC — Warehouse Module Rebuild (Sprint W1)

## Problem

The existing warehouse module is a single 989-line `router.py` with no service layer, no product location model (rows/racks), no internal transfer workflow that enforces two-party confirmation, no product request flow, and no Excel import/export. Six frontend pages exist only as `.corrupted` stubs (types, internal-transfers, revision, recommended-stock, write-off, write-off-reason). Warehouse operators cannot locate stock precisely, cannot move goods between warehouses with an audit trail, and cannot onboard products in bulk. This forces manual workarounds and makes stock accuracy unreliable for SMB clients.

## Who It Is For

- **Warehouse manager** — creates warehouses, rows, racks; approves transfers; imports product lists
- **Storekeeper** — receives goods, sends internal transfers, processes write-offs
- **Sales manager / requester** — submits product requests and sees live stock before choosing quantity
- **Admin** — configures warehouse types, manages permissions

## Done Means

- A warehouse record has a `type` (central, point-of-sale, transit, scrap, custom) and is structured into rows → racks; every stock balance record can optionally carry a `rack_id`.
- An internal transfer passes through states `draft → sent → received` (or `cancelled`); the receiving warehouse confirms receipt and stock moves atomically; partial receipt is NOT supported this round.
- A product request carries category → type → model cascade selection; the UI shows the selected warehouse's live stock before the user types a quantity; saving is blocked server-side if requested qty > on-hand qty.
- Excel import accepts the defined column template and creates/updates products + opening balances; rows with errors are returned in a per-row error report, not a full rollback.
- Excel export (products + stock) downloads a server-generated `.xlsx` from the backend; no client-side generation.
- All six `.corrupted` pages are replaced by working pages; the `.corrupted` files are deleted.

## WON'T DO

- Partial / line-by-line transfer receipt (all-or-nothing this sprint).
- Rack-level stock tracking in `stock_balances` (rack_id is stored on product but balance stays at warehouse level — rack is a location label, not a balance partition).
- Barcode scanning via camera (future sprint).
- Multi-warehouse product request fulfillment (one source warehouse per request).
- Inventory / stocktake (revision) feature rebuild — existing `revision/page.tsx` is kept as-is, not touched.
- Recommended-stock rule engine rebuild — `recommended-stock/page.tsx` kept as-is.
- Manufacturing, semi-product, material, services, cost-of-goods pages — untouched.
- Alembic migration generation — schema_patches.py is sufficient for this sprint.
- Frontend mobile PWA (`/m/warehouse/*`) pages — desktop only this sprint.

## New DB Tables and Columns (via schema_patches.py)

### New tables

```sql
-- Warehouse types (central, pos, transit, scrap, custom)
CREATE TABLE IF NOT EXISTS warehouse_types (
    id              SERIAL PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    code            VARCHAR(50),          -- central | pos | transit | scrap | custom
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_warehouse_types_org_name
    ON warehouse_types(organization_id, name);

-- Rows inside a warehouse
CREATE TABLE IF NOT EXISTS warehouse_rows (
    id              SERIAL PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    warehouse_id    INT  NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    sort_order      INT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_warehouse_rows_wh ON warehouse_rows(warehouse_id);

-- Racks inside a row
CREATE TABLE IF NOT EXISTS warehouse_racks (
    id              SERIAL PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    row_id          INT  NOT NULL REFERENCES warehouse_rows(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    sort_order      INT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_warehouse_racks_row ON warehouse_racks(row_id);

-- Internal transfer header
CREATE TABLE IF NOT EXISTS internal_transfers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    doc_number      VARCHAR(50),
    from_warehouse  INT  NOT NULL REFERENCES warehouses(id),
    to_warehouse    INT  NOT NULL REFERENCES warehouses(id),
    status          VARCHAR(20) NOT NULL DEFAULT 'draft',  -- draft|sent|received|cancelled
    notes           TEXT,
    sent_at         TIMESTAMPTZ,
    received_at     TIMESTAMPTZ,
    sent_by         UUID REFERENCES users(id),
    received_by     UUID REFERENCES users(id),
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_internal_transfers_org ON internal_transfers(organization_id, status);

-- Internal transfer lines
CREATE TABLE IF NOT EXISTS internal_transfer_items (
    id              BIGSERIAL PRIMARY KEY,
    transfer_id     UUID NOT NULL REFERENCES internal_transfers(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id),
    qty             NUMERIC(20,4) NOT NULL,
    unit_id         INT REFERENCES product_units(id)
);

-- Product requests
CREATE TABLE IF NOT EXISTS product_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    doc_number      VARCHAR(50),
    from_warehouse  INT  NOT NULL REFERENCES warehouses(id),  -- source (stock checked here)
    to_warehouse    INT  REFERENCES warehouses(id),            -- destination (optional)
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',    -- pending|approved|rejected|fulfilled
    notes           TEXT,
    requested_by    UUID REFERENCES users(id),
    approved_by     UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_product_requests_org ON product_requests(organization_id, status);

-- Product request lines
CREATE TABLE IF NOT EXISTS product_request_items (
    id              BIGSERIAL PRIMARY KEY,
    request_id      UUID NOT NULL REFERENCES product_requests(id) ON DELETE CASCADE,
    category_id     INT  REFERENCES product_categories(id),
    product_id      UUID NOT NULL REFERENCES products(id),
    qty_requested   NUMERIC(20,4) NOT NULL,
    qty_on_hand     NUMERIC(20,4) NOT NULL DEFAULT 0  -- snapshot at request time
);
```

### Columns added to existing tables

```sql
-- warehouses: add type_id
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS type_id INT REFERENCES warehouse_types(id);

-- products: add default rack location
ALTER TABLE products ADD COLUMN IF NOT EXISTS default_rack_id INT REFERENCES warehouse_racks(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type VARCHAR(100);  -- Tur/model field
```

## New RBAC Permission Codes

Add to `ALL_PERMISSIONS` in `apps/api/app/modules/rbac/permissions.py`:

| Code | Grant to |
|---|---|
| `warehouse.type.view` | admin, manager, viewer |
| `warehouse.type.manage` | admin, manager |
| `warehouse.rack.view` | admin, manager, viewer |
| `warehouse.rack.manage` | admin, manager |
| `warehouse.transfer.view` | admin, manager, viewer |
| `warehouse.transfer.send` | admin, manager |
| `warehouse.transfer.receive` | admin, manager |
| `warehouse.transfer.cancel` | admin |
| `warehouse.request.view` | admin, manager, viewer |
| `warehouse.request.create` | admin, manager, cashier |
| `warehouse.request.approve` | admin, manager |
| `warehouse.product.import` | admin, manager |
| `warehouse.product.export` | admin, manager, viewer |

Existing `warehouse.*` broad permissions remain as fallback.

## API Endpoint Contract (summary)

| Method | Path | Description |
|---|---|---|
| GET/POST | `/warehouse/types` | List / create warehouse types |
| GET/PUT/DELETE | `/warehouse/types/{id}` | Detail / update / deactivate |
| GET | `/warehouse/{wid}/rows` | List rows in a warehouse |
| POST | `/warehouse/{wid}/rows` | Create row |
| PUT/DELETE | `/warehouse/rows/{rid}` | Update / delete row |
| GET | `/warehouse/rows/{rid}/racks` | List racks in a row |
| POST | `/warehouse/rows/{rid}/racks` | Create rack |
| PUT/DELETE | `/warehouse/racks/{rack_id}` | Update / delete rack |
| GET | `/warehouse/transfers` | List internal transfers (filter: status, from/to wh) |
| POST | `/warehouse/transfers` | Create draft transfer |
| POST | `/warehouse/transfers/{id}/send` | Mark as sent, deduct from source |
| POST | `/warehouse/transfers/{id}/receive` | Mark as received, credit destination |
| POST | `/warehouse/transfers/{id}/cancel` | Cancel draft/sent |
| GET | `/warehouse/requests` | List product requests |
| POST | `/warehouse/requests` | Create request (validates qty <= on_hand) |
| POST | `/warehouse/requests/{id}/approve` | Approve |
| POST | `/warehouse/requests/{id}/reject` | Reject |
| GET | `/warehouse/stock/on-hand` | Stock with filters: warehouse_id, category_id, product_id |
| POST | `/warehouse/products/import` | Excel upload, returns `{created, updated, errors[]}` |
| GET | `/warehouse/products/export` | Download .xlsx (filters: warehouse_id, category_id) |

## Excel Import Template Columns

| Column (A→L) | Field | Required | Notes |
|---|---|---|---|
| A | name | Yes | Product name |
| B | sku | No | Auto-generated if blank |
| C | barcode | No | |
| D | category | No | Matched by name, created if missing |
| E | product_type | No | Tur/model string |
| F | unit | No | Matched by name |
| G | purchase_price | No | Decimal |
| H | sale_price | No | Decimal |
| I | warehouse_name | No | For opening balance row |
| J | opening_qty | No | Initial stock |
| K | opening_cost | No | Unit cost for opening balance |
| L | rack_name | No | Row / Rack label (free text, stored as default_rack_id if matched) |

Row 1 = header. Backend returns JSON: `{created: N, updated: N, errors: [{row: R, message: "..."}]}`.

## UI Pages

| Path | Status | Action |
|---|---|---|
| `/warehouse/warehouses` | Exists (working) | Enhance: add type selector |
| `/warehouse/types` | .corrupted exists + working page exists | Delete .corrupted, rebuild working page |
| `/warehouse/[wid]/rows` | New | New page |
| `/warehouse/[wid]/rows/[rid]/racks` | New | New page |
| `/warehouse/products` | Exists (working) | Enhance: add product_type, rack picker, import/export buttons |
| `/warehouse/internal-transfers` | .corrupted + working both exist | Delete .corrupted, rebuild working page |
| `/warehouse/requests` | New | New page |
| `/warehouse/category` | Exists (working) | No change |
| `/warehouse/income` | Exists (working) | No change |
| `/warehouse/write-off` | .corrupted + working both exist | Delete .corrupted, keep working |
| `/warehouse/write-off-reason` | .corrupted + working both exist | Delete .corrupted, keep working |
| `/warehouse/revision` | .corrupted + working both exist | Delete .corrupted, keep working |
| `/warehouse/recommended-stock` | .corrupted + working both exist | Delete .corrupted, keep working |

## User Flow: Internal Transfer

1. Manager opens `/warehouse/internal-transfers` → clicks "Yangi o'tkazma".
2. Selects From warehouse, To warehouse, adds product lines (product + qty).
3. Saves as `draft`. Stock NOT moved yet.
4. Clicks "Yuborish" → status becomes `sent`; source warehouse stock decremented atomically.
5. Receiving warehouse manager opens transfer list, clicks "Qabul qilish" → status becomes `received`; destination stock incremented.
6. Either side can cancel while in `draft`; only sender can cancel while in `sent` (admin can always cancel).

## User Flow: Product Request

1. Requester opens `/warehouse/requests` → clicks "So'rov yuborish".
2. Selects source warehouse.
3. Selects Category → product type/model → Product (cascade dropdowns).
4. On product selection: API call to `/warehouse/stock/on-hand?warehouse_id=X&product_id=Y` returns current qty. UI shows "Mavjud: N dona".
5. Requester types desired qty. Frontend and backend both reject if qty > on_hand.
6. Submits. Status = `pending`.
7. Manager approves or rejects from the same list with a filter tab.

## Risks

- `internal_transfers` table name conflicts with existing frontend page directory — verify no existing backend table of that name before running patches (the existing page was `.corrupted`, so likely no live data).
- `openpyxl` is already in `requirements.txt` (v3.1.5) — no new dependency needed; confirm no version pin conflicts.
- Deleting `.corrupted` files is safe only if the corresponding working `.tsx` exists and is functional — must verify before delete in T-003.
- The router.py refactor (splitting into service layer) risks breaking existing endpoints that sale/finance modules call (e.g., `_stock_apply`). Service functions must keep the same signature.
- `product_type` column on `products` is a free-text string this sprint; a future sprint may want it normalized to a lookup table — migration must be additive.
- Two-party transfer confirmation requires the `sent_by` and `received_by` users to be in the same organization — enforced via `organization_id` check on both warehouses.

## Open Questions

- Should `product_requests` auto-create an `internal_transfer` upon approval, or remain a manual step? Assumption: manual this sprint.
- Should opening balance import via Excel create a `warehouse_income` record for audit, or directly patch `stock_balances`? Assumption: direct patch with an audit note field.
- Is `doc_number` for transfers auto-generated (sequential per org) or user-entered? Assumption: auto-generated (`TRF-YYYY-NNNN`).
