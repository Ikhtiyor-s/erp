# SPEC-2 — Product BOM + Warehouse Cells + Mobile Pick Workflow + Transfer ProductPicker

**Date**: 2026-08-26
**Status**: Revised (v2 — Printer scope removed; Transfer UX added)
**Scope**: Feature 1 (BOM) + Feature 2 (Cells + Pick) + Feature 3 (ProductPicker for Transfer & Request)

---

## Problem

Operators have no way to define what raw materials make up a finished product, so fulfillment teams pick by memory with no cell addresses and no digital picking list. Admins cannot see picking progress in real time. Separately, warehouse workers creating internal transfers must search products one by one (min 2-char search) — there is no paginated overview of available stock per source warehouse, making the form slow and error-prone for large catalogs.

---

## Who it's for

| Persona | Use |
|---|---|
| Warehouse worker (mobile) | Sees pick list with cell addresses, marks items found/not-found |
| Admin / Manager | Defines BOM per product, tracks pick progress per order |
| Cashier | Receives contact from picker when item is missing |
| Warehouse supervisor | Creates internal transfers using the paginated stock table |
| Purchasing manager | Creates product requests using the same paginated picker |

---

## Done means

1. A product can have a BOM: list of (component, qty, unit) saved and retrievable via API; cycle detection prevents A→B→A loops.
2. Every rack has cells (`warehouse_cells`) with alphanumeric codes; a product can have a `default_cell_id`; cell location is shown on pick list.
3. Mobile worker at `app/m/orders/` sees order list → detail → can mark each item "Topildi" or contact cashier via in-app message; state persists in `order_pick_items` and `order_pick_messages`.
4. Admin order list shows `picked/total` badge and progress bar; order detail shows per-item pick status and cashier-contact audit trail.
5. `GET /warehouse/products?warehouse_id=&page=&limit=&q=&category_id=&product_type=` returns paginated products with `on_hand` quantity for the given warehouse; this endpoint powers the reusable `ProductPicker` component.
6. Internal transfer form: after selecting source warehouse, a paginated product table (30/page) appears with columns `#, Name, Model/Type, Category, On-hand, Unit, [+ Add]`; selected products appear in a "Selected" section above where quantities are entered.

---

## WON'T DO

- **Printer management**: `printers`, `product_printer`, `order_print_jobs` tables, printer CRUD endpoints, `POST /orders/{oid}/print`, printer assignment UI, printer permission codes — all deferred indefinitely.
- **Product substitution**: cashier replacing a missing item with an alternative — deferred to a separate sprint.
- **Real-time WebSocket push**: admin progress dashboard polls every 15s; WebSocket is a future upgrade.
- **BOM multi-level explosion**: only one level deep in this sprint; recursive sub-assembly flattening deferred.
- **Cell capacity tracking**: max items per cell, overflow alerts — not in this sprint.
- **Barcode/QR scan** on mobile pick — buttons only this round.
- **ProductPicker** as a standalone page or reused outside Transfer and Product Request — other forms are out of scope this sprint.

---

## Data Model

### New tables (all require `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`)

```sql
-- BOM
product_bom (
  id                  BIGSERIAL PRIMARY KEY,
  organization_id     UUID NOT NULL,
  parent_product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  component_product_id UUID NOT NULL REFERENCES products(id),
  quantity            NUMERIC(20,4) NOT NULL CHECK (quantity > 0),
  unit_id             INT REFERENCES units(id),
  notes               TEXT,
  UNIQUE (organization_id, parent_product_id, component_product_id)
)
INDEX: (organization_id, parent_product_id)

-- Warehouse cells
warehouse_cells (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  rack_id         INT NOT NULL REFERENCES warehouse_racks(id) ON DELETE CASCADE,
  code            VARCHAR(30) NOT NULL,
  is_active       BOOLEAN DEFAULT TRUE,
  UNIQUE (organization_id, rack_id, code)
)
INDEX: (organization_id, rack_id)

-- Pick tracking
order_pick_items (
  id              BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL,
  order_id        UUID NOT NULL,
  item_id         UUID NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  picked_by       UUID REFERENCES users(id),
  picked_at       TIMESTAMPTZ,
  UNIQUE (organization_id, order_id, item_id)
)
INDEX: (organization_id, order_id)

-- Picker → Cashier messages
order_pick_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  order_id        UUID NOT NULL,
  from_user_id    UUID REFERENCES users(id),
  kind            VARCHAR(10) NOT NULL,
  body            TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
)
INDEX: (organization_id, order_id)
```

### Altered columns
- `products`: add `default_cell_id UUID REFERENCES warehouse_cells(id)` (nullable, `ADD COLUMN IF NOT EXISTS`)

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/warehouse/products/{id}/bom` | List BOM components |
| POST | `/warehouse/products/{id}/bom` | Add component (cycle check) |
| PATCH | `/warehouse/products/{id}/bom/{bom_id}` | Update qty/unit/notes |
| DELETE | `/warehouse/products/{id}/bom/{bom_id}` | Remove component |
| GET | `/warehouse/racks/{rack_id}/cells` | List cells in rack |
| POST | `/warehouse/racks/{rack_id}/cells` | Create cell |
| PATCH | `/warehouse/racks/{rack_id}/cells/{cid}` | Update cell |
| DELETE | `/warehouse/racks/{rack_id}/cells/{cid}` | Deactivate cell |
| GET | `/orders/{oid}/pick` | Pick list: items + BOM + cell + status |
| PATCH | `/orders/{oid}/items/{iid}/pick` | Mark item picked or not_found |
| GET | `/orders/{oid}/pick/messages` | Cashier contact history |
| POST | `/orders/{oid}/pick/messages` | Send message/log call |
| GET | `/warehouse/products` | Paginated product list with on_hand per warehouse |

---

## UI Screens

### Desktop
- `/warehouse/products/[id]` — BOM tab: component table + add/edit/delete rows
- `/warehouse/warehouses/[id]/racks/[rack_id]` — Cells sub-section below racks list
- `/sales/orders/[id]` — Pick progress panel: `picked/total` badge, per-item status, audit trail
- `/warehouse/internal-transfers/new` — ProductPicker replaces search-only input

### Mobile (`app/m/`)
- `/m/orders` — Order list: card per order with doc_number, customer, `n/total` badge
- `/m/orders/[id]` — Order detail: item list with cell address, "Topildi" button, "Kassirga murojaat" button → modal

---

## ProductPicker UX (Transfer & Request forms)

After source warehouse is selected, a paginated table renders below the form header:

| Column | Source |
|---|---|
| `#` | row index (1-based, current page) |
| Nomi | `products.name` |
| Model / Tur | `products.model` / `product_type` label |
| Kategoriya | category name |
| Qoldiq | `on_hand` from inventory for selected warehouse |
| Birlik | unit name |
| `[+ Qo'shish]` | button — adds product to "Selected" section |

- Filter panel above table: free-text search (`q`), category dropdown, product_type dropdown. All filters are URL-query-driven.
- Pagination: 30 rows/page. Page controls at bottom.
- Selected products appear in a "Tanlangan mahsulotlar" section at the top of the form; each row has a quantity input and a remove button.
- The same `ProductPicker` component is used in Product Request form (T-031).

---

## Risks

1. **BOM cycle detection** must be done in Python (DFS over existing BOM rows for org) — if BOM graph is large, this could be slow. Mitigation: limit BOM depth to 10 levels; index `(organization_id, parent_product_id)`.
2. **order_pick_items.item_id FK target** — backend-dev must verify the exact column name for sale order line items in `sale` module before writing migration; if items can be deleted, use soft reference (plain UUID, no FK).
3. **Polling lag** on admin pick progress — auto-refresh every 15s; flag in code for future WebSocket upgrade.
4. **products.default_cell_id ALTER** — safe for existing rows; use `ADD COLUMN IF NOT EXISTS`.
5. **on_hand query performance** — `GET /warehouse/products` must join inventory; ensure composite index `(organization_id, warehouse_id)` exists on the inventory/stock table before writing the endpoint.
6. **ProductPicker state management** — component must not re-mount or lose selected items when filters change. Use local state lifted to parent form.

---

## Wave / Parallel Execution Plan

### Wave 1 (parallel — no cross-dependencies)
| Ticket | Owner | Work |
|---|---|---|
| T-020 | backend-dev | DB migration: BOM + Cells + Pick tables |
| T-021 | backend-dev | RBAC: new permission codes (no printer codes) |
| T-031-product-picker-component | frontend-dev | `ProductPicker.tsx` component (mock data / props-driven, no real API yet) |

### Wave 2 (parallel — depends on Wave 1)
| Ticket | Owner | Work |
|---|---|---|
| T-022 | backend-dev | BOM CRUD endpoints + cycle detection |
| T-024 | backend-dev | Cells CRUD + product default_cell_id |
| T-025 | backend-dev | Pick workflow endpoints |
| T-026-warehouse-products-paginated | backend-dev | `GET /warehouse/products` paginated + on_hand |

### Wave 3 (parallel — depends on Wave 2)
| Ticket | Owner | Work |
|---|---|---|
| T-026-bom-ui | frontend-dev | BOM editor tab on product detail |
| T-028 | frontend-dev | Cells UI + product cell picker |
| T-029 | frontend-dev | Mobile pick workflow |
| T-030 | frontend-dev | Admin order pick progress |
| T-032-transfer-picker-integration | frontend-dev | Wire ProductPicker into transfer form |
| T-033-request-picker-integration | frontend-dev | Wire ProductPicker into product request form |
