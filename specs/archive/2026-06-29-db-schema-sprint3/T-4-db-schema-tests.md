# T-4 — db-schema-tests

## Goal

`apps/api/tests/test_db_schema_sprint3.py` yangi test faylini yaratish — sprint #3 barcha
o'zgarishlarini (C1 cast fix, C4 indekslar, M3 unique constraint) smoke va unit testlar bilan
qamrab olish, jami ~10 ta test.

## Acceptance criteria

- `apps/api/tests/test_db_schema_sprint3.py` yangi fayl yaratilgan, ~10 ta pytest async test
- Quyidagi test guruhlari mavjud:

**Indeks mavjudlik smoke testlari (C4 + M3)**
- `test_ix_invoices_org_date_exists` — `SELECT 1 FROM pg_indexes WHERE indexname = 'ix_invoices_org_date'` — natija ROW qaytaradi
- `test_ix_tasks_org_open_exists` — `ix_tasks_org_open` mavjud
- `test_ix_refresh_tokens_user_active_exists` — `ix_refresh_tokens_user_active` mavjud
- `test_ix_user_invitations_expires_exists` — `ix_user_invitations_expires` mavjud
- `test_uq_payment_tx_provider_exists` — `SELECT 1 FROM pg_indexes WHERE indexname = 'uq_payment_tx_provider'` — mavjud (yoki T-3 SKIP bo'lsa `pytest.skip("T-3 skipped: duplicates found")`)

**Idempotency testi (C4)**
- `test_schema_patches_idempotent` — API restart'dan keyin (`lifespan` patches) `pg_indexes` da indeks bir marta bo'lsa ham, ikkinchi restart'da xato chiqmaydi — `IF NOT EXISTS` ishlaydi

**Unique constraint testi (M3)**
- `test_payment_tx_unique_violation` — DB'ga `(provider='test_click', provider_tx_id='tx-dup-001')` kiritiladi, keyin xuddi shu bilan qayta INSERT uriniladi → `asyncpg.exceptions.UniqueViolationError` yoki SQLAlchemy `IntegrityError` ushlanadi
- `test_payment_tx_null_provider_tx_id_allowed` — `provider_tx_id=NULL` bilan bir nechta yozuv INSERT qilinadi → hech qanday xato yo'q (partial index `WHERE provider_tx_id IS NOT NULL`)

**Cast fix regression testi (C1)**
- `test_statistics_endpoint_no_date_cast_in_where` — `GET /api/v1/statistics/sales?date_from=2026-01-01&date_to=2026-01-31` so'rovi yuboriladi → 200 yoki 401/403 (autentifikatsiya), LEKIN 500 xatosi bo'lmasligi shart (cast xatosi emas)
- `test_finance_endpoint_date_range` — `GET /api/v1/finance/invoices?date_from=2026-01-01&date_to=2026-01-31` → 200 yoki 401/403, 500 bo'lmasligi shart

- Mavjud barcha testlar PASS: `docker exec erp-api pytest apps/api/tests/ -v` → 49+ PASSED
- Yangi testlar ham PASS: `docker exec erp-api pytest apps/api/tests/test_db_schema_sprint3.py -v`

## Muhim eslatmalar

- **conftest.py dan foydalaning**: mavjud `auth_token`, `db` fixture'larini qayta ishlating — yangi login qo'shmaslik (sprint #2 dagi 429 rate-limit saboqi: modul darajasida token cache ishlatilgan)
- **T-3 SKIP holati**: agar T-3 duplikat tufayli skip qilingan bo'lsa, `test_uq_payment_tx_provider_exists` testini `pytest.mark.skip(reason="T-3: duplicates found, manual cleanup required")` bilan belgilang
- **Async test**: `@pytest.mark.asyncio` va `async def` ishlatilsin — mavjud test fayllari pattern'ini kuzating
- **DB fixture**: `pg_indexes` so'rovi `text("SELECT ...")` bilan `db` fixture'dagi `AsyncSession` orqali bajarilsin
- **Test ma'lumotlari tozalash**: `test_payment_tx_unique_violation` da INSERT qilingan test yozuvlar `try/finally` yoki `yield` fixture'da o'chirilsin

## Files likely touched

- `apps/api/tests/test_db_schema_sprint3.py` (yangi fayl)
- `apps/api/tests/conftest.py` (faqat yangi fixture zarur bo'lsa)

## Owner role

`backend-dev`

## Depends on

`T-1`, `T-2`, `T-3`

## Estimated effort

S (30 daqiqa)
