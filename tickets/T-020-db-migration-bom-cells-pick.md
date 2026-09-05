# T-020 — DB Migration: BOM, Cells, Pick tables

**Owner**: backend-dev
**Size**: M
**Depends on**: none

---

## Goal

Add all new tables and column alterations for SPEC-2 (BOM, warehouse cells, pick workflow) to `schema_patches.py` using idempotent DDL. Printer tables are NOT part of this ticket.

---

## Files likely touched

- `apps/api/app/db/schema_patches.py` — append new PATCHES entries

---

## Rationale

All subsequent backend tickets depend on the schema existing. Must land first. Using `schema_patches.py` per project convention; alembic migration may follow for production.

---

## Acceptance criteria

- [ ] `product_bom` table created with `organization_id NOT NULL`, composite index `(organization_id, parent_product_id)`, `UNIQUE(organization_id, parent_product_id, component_product_id)`, `CHECK (quantity > 0)`
- [ ] `warehouse_cells` table created with `organization_id NOT NULL`, `rack_id INT REFERENCES warehouse_racks(id) ON DELETE CASCADE`, `UNIQUE(organization_id, rack_id, code)`, index `(organization_id, rack_id)`
- [ ] `order_pick_items` table created with `organization_id NOT NULL`, `UNIQUE(organization_id, order_id, item_id)`, index `(organization_id, order_id)`; `item_id` FK target confirmed against actual sale order items table (if FK is risky due to deletion, use plain UUID column with index instead)
- [ ] `order_pick_messages` table created with `organization_id NOT NULL`, index `(organization_id, order_id)`
- [ ] `ALTER TABLE products ADD COLUMN IF NOT EXISTS default_cell_id UUID REFERENCES warehouse_cells(id)` — nullable, safe for existing rows
- [ ] No `printers`, `product_printer`, or `order_print_jobs` tables are created
- [ ] All patches are idempotent: app restart does not error when patches already applied
- [ ] `docker compose restart api` succeeds and logs show patches applied without error

---

## Notes

Before writing the migration, check `apps/api/app/modules/sale/` or `infra/postgres/init.sql` to confirm the exact table/column name for sale order line items so `order_pick_items.item_id` references the right target.
