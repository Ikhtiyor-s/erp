# T-2 — composite-indexes

## Goal

13 ta yangi composite va partial indeksni `apps/api/app/db/schema_patches.py` `PATCHES`
ro'yxati oxiriga qo'shish — hammasini `CREATE INDEX IF NOT EXISTS` bilan idempotent tarzda.

## Acceptance criteria

- `apps/api/app/db/schema_patches.py` `PATCHES` ro'yxati oxirida quyidagi 13 ta indeks SQL iborasi mavjud:

```sql
CREATE INDEX IF NOT EXISTS ix_invoices_org_date ON invoices (organization_id, issue_date DESC);
CREATE INDEX IF NOT EXISTS ix_supplies_org_date ON supplies (organization_id, supply_date DESC);
CREATE INDEX IF NOT EXISTS ix_purchase_orders_org_date ON purchase_orders (organization_id, order_date DESC);
CREATE INDEX IF NOT EXISTS ix_customer_orders_org_date ON customer_orders (organization_id, order_date DESC);
CREATE INDEX IF NOT EXISTS ix_transfers_org_date ON transfers (organization_id, transfer_date DESC);
CREATE INDEX IF NOT EXISTS ix_sale_returns_org_date ON sale_returns (organization_id, return_date DESC);
CREATE INDEX IF NOT EXISTS ix_contracts_org_start ON contracts (organization_id, start_date DESC);
CREATE INDEX IF NOT EXISTS ix_inventories_org ON inventories (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_tasks_org_open ON tasks (organization_id, due_date) WHERE status NOT IN ('done', 'cancelled');
CREATE INDEX IF NOT EXISTS ix_tasks_assignee_open ON tasks (assignee_id, due_date) WHERE status NOT IN ('done', 'cancelled');
CREATE INDEX IF NOT EXISTS ix_refresh_tokens_user_active ON refresh_tokens (user_id) WHERE revoked = FALSE;
CREATE INDEX IF NOT EXISTS ix_refresh_tokens_expires ON refresh_tokens (expires_at) WHERE revoked = FALSE;
CREATE INDEX IF NOT EXISTS ix_user_invitations_expires ON user_invitations (expires_at) WHERE accepted_at IS NULL AND cancelled_at IS NULL;
```

- `docker compose restart api` startup xatosiz tugaydi — lifespan'da patches idempotent ishlaydi
- Agar biror jadval yoki ustun DB'da mavjud bo'lmasa (masalan `customer_orders.order_date`), shu indeks o'tkazib yuboriladi va kod kommentida `# SKIP: jadval/ustun mavjud emas — tekshirildi YYYY-MM-DD` izoh qoldiriladi
- `infra/postgres/init.sql` ga hech narsa yozilmaydi

## Muhim eslatmalar

- **Avvaldan tekshiring**: har jadval uchun `Grep -r "class <TableName>" apps/api/app/modules/` yoki `infra/postgres/init.sql` da ustun mavjudligini tasdiqlang. Masalan `customer_orders` jadvalda `order_date` ustuni bor-yo'qligini aniqlang.
- **CONCURRENTLY ishlatilmaydi**: lifespan kontekstida transaksiya ichida ishlaydi, `CONCURRENTLY` ruxsat berilmaydi.
- **Har patch bitta SQL string**: `PATCHES` ro'yxatidagi har element bitta SQL string bo'lishi kerak — mavjud pattern'ga qarang.
- **Tartib muhim emas**: yangi indekslar oxiridan qo'shiladi, mavjud patch'lar o'zgartirilmaydi.

## Files likely touched

- `apps/api/app/db/schema_patches.py`

## Owner role

`backend-dev`

## Depends on

`none`

## Estimated effort

S (30 daqiqa)
