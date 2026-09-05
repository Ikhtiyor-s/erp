# T-101: Backend — MXIK katalog jadval + seed + qidiruv endpoint

**Wave:** 4A
**Owner:** backend-dev
**Size:** M
**Depends on:** none

## Goal
Soliq.uz public MXIK tovar katalogini DB'ga seed qilish va tezkor qidiruv endpoint yaratish.

## Files likely touched
- `apps/api/app/db/schema_patches.py` (`mxik_products` jadval — global, `organization_id` yo'q, reference data)
- `apps/api/app/modules/reference/router.py` (yangi endpoint)
- `apps/api/app/modules/rbac/permissions.py` (`reference.read`)
- `apps/api/app/db/` — seed script yoki migration (CSV import)

## Schema
```sql
CREATE TABLE IF NOT EXISTS mxik_products (
    code VARCHAR(20) PRIMARY KEY,
    name_uz TEXT NOT NULL,
    name_ru TEXT,
    unit VARCHAR(20),
    group_code VARCHAR(10),
    group_name TEXT
);
CREATE INDEX IF NOT EXISTS idx_mxik_name ON mxik_products USING gin(to_tsvector('simple', name_uz));
```

## Acceptance criteria
- `GET /reference/mxik/search?q=non&limit=20` — 200, JSON array `{code, name_uz, name_ru, unit}`.
- Full-text search (ilike yoki pg tsvector) ishlaydi.
- Kamida 1000 ta row seed qilingan (Soliq.uz MXIK CSV dan).
- Endpoint auth talab qiladi, lekin organization_id filter yo'q (global katalog).
- `reference.read` permission tekshiriladi.

## How we'll know it's done
`GET /reference/mxik/search?q=go'sht` kamida 1 ta natija qaytaradi; `?q=nonexistent12345` bo'sh array qaytaradi.
