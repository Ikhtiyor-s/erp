---
name: db-migration-safety
description: PostgreSQL schema migration xavfsizligi, idempotent DDL, indeks strategiyasi, multi-tenant FK CASCADE qoidalari. Use when proposing schema changes in schema_patches.py or new alembic migrations.
---

# DB migration safety (Aniq ERP)

## Ikki yo'l: schema_patches.py vs alembic

| Aspect | `schema_patches.py` | `alembic/versions/*.py` |
|---|---|---|
| Qachon | Tezkor patch, dev/MVP | Production deploy, kuchli o'zgarishlar |
| Idempotency | Talab (har startup'da ishlaydi) | Bir martalik (head bilan track) |
| Transactional | Ha (`engine.begin()`) | Ha (default) |
| `CREATE INDEX CONCURRENTLY` | ❌ ishlamaydi (tranzaksiya ichida) | ✅ alembic `transaction_per_migration=True` |
| Rollback | Yo'q (forward-only) | `downgrade()` yozish mumkin |

**Hozirgi loyiha asosan `schema_patches.py` ishlatadi.** Production scale uchun alembic'ga o'tish — keyingi sprint.

## schema_patches.py qoidalari

### Idempotency (har DDL `IF NOT EXISTS` bilan)

```sql
-- ✅ YAXSHI
CREATE TABLE IF NOT EXISTS new_thing (...);
CREATE INDEX IF NOT EXISTS idx_new_thing_org ON new_thing (organization_id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS mxik VARCHAR(20);

-- ❌ YOMON — restart'da fail bo'ladi
CREATE TABLE new_thing (...);
CREATE INDEX idx_new_thing_org ON new_thing (organization_id);
```

### DROP CONSTRAINT idempotency (yaqqol IF EXISTS yo'q)

```sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'roles'::regclass AND conname = 'roles_code_key'
  ) THEN
    ALTER TABLE roles DROP CONSTRAINT roles_code_key;
  END IF;
END $$;
```

## Multi-tenant talablar

Har yangi domain jadval:

```sql
CREATE TABLE IF NOT EXISTS my_thing (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    -- ... fields
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composite indeks majburiy
CREATE INDEX IF NOT EXISTS idx_my_thing_org ON my_thing (organization_id);

-- Yana ko'p ishlatiladigan filter:
CREATE INDEX IF NOT EXISTS idx_my_thing_org_status
    ON my_thing (organization_id, status)
    WHERE status IN ('active', 'pending');  -- partial indeks
```

## FK indeks (KRITIK — Postgres avtomatik QILMAYDI)

Har FK column o'ziga indeks talab qiladi:

```sql
-- Parent jadval:
CREATE TABLE orders (id UUID PRIMARY KEY, ...);

-- Child jadval:
CREATE TABLE order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,  -- ← FK
    product_id UUID REFERENCES products(id),                 -- ← FK
    ...
);

-- MAJBURIY:
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items (product_id);
```

Indeks bo'lmasa:
- `DELETE FROM orders WHERE id = X` → CASCADE seq scan order_items'da. Millionlik jadvalda — daqiqalar
- `SELECT * FROM order_items WHERE order_id = X` — seq scan har ko'rishda

## ON DELETE qoidalari (aniq yozish)

| Reference | Tavsiya | Sabab |
|---|---|---|
| `organizations(id)` — child domain table | `CASCADE` | Org o'chsa, hammasi o'chadi (lekin soft-delete tavsiya etiladi — DELETE qilmang) |
| `users(id)` — child | `RESTRICT` / yo'q yozma (default NO ACTION) | Audit/forensic uchun saqlanadi |
| `roles(id)` — `user_organizations.role_id` | `RESTRICT` | Tasodifiy role delete user'larni ruxsatsiz qoldirmasligi uchun |
| `categories(id)` — `products.category_id` | `SET NULL` | Kategoriya o'chsa, mahsulot qoladi |
| Child→Parent (sale_items.sale_id) | `CASCADE` | Sale o'chsa, item'lar ham |

```sql
-- ✅ Aniq yozish (default NO ACTION'ga ishonmang)
order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE
role_id INT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT
category_id INT REFERENCES categories(id) ON DELETE SET NULL
```

## ADD COLUMN xavfsizligi

| Operation | Lock | Production OK? |
|---|---|---|
| `ADD COLUMN xxx INT` (NULL default) | ACCESS EXCLUSIVE, instant (PG 11+) | ✅ |
| `ADD COLUMN xxx INT DEFAULT 0` | instant (PG 11+) — constant default | ✅ |
| `ADD COLUMN xxx UUID DEFAULT gen_random_uuid()` | TABLE REWRITE (volatile expr) | ❌ — 2-step kerak |
| `ADD COLUMN xxx INT NOT NULL DEFAULT 0` | instant (PG 11+) | ✅ |
| `ADD COLUMN xxx INT NOT NULL` (no default) | FAIL on existing rows | ❌ — 2-step kerak |

2-step pattern:
```sql
-- 1: nullable add
ALTER TABLE x ADD COLUMN IF NOT EXISTS new_col TEXT;
-- 2: backfill (alohida migration yoki app code)
UPDATE x SET new_col = 'default' WHERE new_col IS NULL;
-- 3: NOT NULL constraint (alohida deploy)
ALTER TABLE x ALTER COLUMN new_col SET NOT NULL;
```

## CREATE INDEX

Schema_patches'da: oddiy `CREATE INDEX IF NOT EXISTS`. Dev OK, lekin **katta jadvalda** ACCESS EXCLUSIVE lock — barcha yozuvlar muzlaydi.

Production'da alembic migration alohida:
```python
def upgrade():
    op.execute("COMMIT")  # exit transaction
    op.execute("CREATE INDEX CONCURRENTLY ix_x ON x (y)")
```

Yoki:
```python
# migration ichida
op.create_index('ix_x', 'x', ['y'], postgresql_concurrently=True)
# va alembic.ini:
# transaction_per_migration = true
```

## Partial indeks (selective filter)

```sql
-- Faqat aktiv yozuvlar uchun (50%+ inactive bo'lsa, 50% kichikroq)
CREATE INDEX IF NOT EXISTS idx_users_active_email
    ON users (email) WHERE is_active = TRUE;

-- Cash movements polymorphic FK
CREATE INDEX IF NOT EXISTS idx_cash_mov_customer
    ON cash_movements (customer_id, movement_date DESC)
    WHERE customer_id IS NOT NULL;
```

## pg_trgm GIN (ILIKE '%...%' search)

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_customers_name_trgm
    ON customers USING GIN (name gin_trgm_ops);
```

Planner bitmap-AND orqali `idx_customers_org` (B-tree) + GIN trgm'ni birlashtiradi.

## Date / timestamp WHERE (cast yo'q!)

```sql
-- ❌ YOMON — cast indeksni sindiradi
WHERE cm.movement_date::date BETWEEN :df AND :dt

-- ✅ YAXSHI
WHERE cm.movement_date >= :df
  AND cm.movement_date < (:dt::date + INTERVAL '1 day')
```

## Audit log scale concern

`audit_log` 1k org × 1k events/day = 365M qator/yil. Production'da:
- **Partitioning by month** (RANGE) — `pg_partman` extension
- **Free-text search**: `diff::text ILIKE '%...%'` faqat oxirgi 30 kunda
- **Keyset pagination** o'rniga LIMIT/OFFSET

Hozircha (dev/MVP) heap table — keyingi sprint architectural ish.

## Migration checklist (har patch uchun)

```
□ Idempotent (IF NOT EXISTS / IF EXISTS)?
□ organization_id ustuni va indeksi (agar domain table)?
□ Har FK column o'z indeksiga ega?
□ ON DELETE qoidasi aniq yozilgan?
□ ADD COLUMN NULLABLE yoki INSTANT-default?
□ Production scale'ga CONCURRENTLY indeks kerakmi (alembic'ga ko'chirilsinmi)?
□ Date cast WHERE'da yo'qmi?
```
