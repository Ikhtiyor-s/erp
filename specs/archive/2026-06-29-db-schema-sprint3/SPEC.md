# SPEC — DB schema CRITICAL paketi: cast olib tashlash + indekslar + unique constraint / Sprint #3 (2026-06-29)

> PM tomonidan yoziladi. Bu **PROPOSE** bosqichi.
> Format: `.claude/skills/openspec-format.md` ga qarang.

## Niyat

Aniq ERP DB schema auditi production miqyosida (multi-tenant, 100+ org) ishlashga to'sqinlik
qiluvchi 3 ta muammoni aniqladi. Birinchi: `field::date` cast WHERE clauselarda 17 joyda mavjud
— bu PostgreSQL indeks skanlashini to'liq o'chirib qo'yadi va katta org'larda sekin so'rovlarga
olib keladi (sprint #2'da `sale/router.py` tuzatildi, lekin boshqa 5 ta faylda qoldi). Ikkinchi:
9 ta asosiy domain jadvalda `(organization_id, date_col)` composite indeks yo'q — hozir har
tenant so'rovi full table scan qiladi. Uchinchi: `payment_transactions` da `(provider,
provider_tx_id)` indeks NON-UNIQUE — bir xil to'lov ikki marta kiritilishi mumkin (idempotency
garanti yo'q). Bu muammolar to'g'ridan-to'g'ri pilot mijoz onbordingiga ta'sir qiladi va
production scaledaga yetolmasdan tuzatilishi shart.

## Tegishli foydalanuvchi

- `admin` — boshqaruv bo'limlari (statistika, moliya, ishlab chiqarish) — sekin dashboard so'rovlaridan to'g'ridan-to'g'ri ta'sir ko'radi
- `manager` — sotuv, ombor, xaridlar — hisobot sahifalari sekinlashadi
- `accountant` — moliya hisobotlari, invoice ro'yxatlari — sekin so'rovlar
- `cashier` — kassa to'lovlari — duplicate payment risk (M3)
- Barcha autentifikatsiyalangan foydalanuvchilar — dashboard va hisobot so'rovlari yaxshilanadi

## Acceptance criteria (Given/When/Then)

---

### C1: `field::date` cast olib tashlash

**Scenario 1 (happy path): Statistics dashboard so'rovi to'g'ri sana oralig'ini qaytaradi**
- **Given** manager `Org A` da kirgan, `?date_from=2026-06-01&date_to=2026-06-30` parametrlari bilan
- **When** `GET /api/v1/statistics/sales` so'rovi yuboriladi
- **Then** 200 javob qaytadi, `sale_date` filterlash `sale_date >= :df AND sale_date < (:dt::date + INTERVAL '1 day')` pattern'da ishlaydi
- **And** EXPLAIN ANALYZE natijasida `Seq Scan` o'rniga `Index Scan` ko'rinadi (agar indeks qo'shilgan bo'lsa)

**Scenario 2 (negative): `::date` cast WHERE clauseda qolmaydi**
- **Given** `apps/api/app/modules/statistics/router.py` fayli
- **When** `Grep -n "::date" statistics/router.py` bajariladi
- **Then** WHERE/AND clauselarda `::date` cast topilmaydi — faqat SELECT clauselarda (display format uchun) qolishi mumkin

**Scenario 3 (boundary): Yil o'tish — 31 dekabr / 1 yanvar oralig'i to'g'ri filterlaydi**
- **Given** `sale_date` qiymatlari `2025-12-31 23:59:59` va `2026-01-01 00:00:00` DB'da bor
- **When** `?date_from=2025-12-31&date_to=2025-12-31` bilan so'rov yuboriladi
- **Then** faqat `2025-12-31 23:59:59` qaytadi — `2026-01-01 00:00:00` chiqmaydi (interval `< 2026-01-01 00:00:00`)

---

### C4: Composite indekslar

**Scenario 1 (happy path): `invoices` ro'yxati org filterlash bilan tez ishlaydi**
- **Given** `ix_invoices_org_date` indeksi `schema_patches.py` da qo'shilgan va API restart qilingan
- **When** `GET /api/v1/finance/invoices?org_id=<uuid>` so'rovi yuboriladi
- **Then** 200 javob, `pg_indexes` jadvalida `ix_invoices_org_date` yozuvi mavjud

**Scenario 2 (negative): Indeks mavjud bo'lsa, `CREATE INDEX IF NOT EXISTS` xato bermaydi**
- **Given** `ix_invoices_org_date` allaqachon yaratilgan
- **When** `docker compose restart api` bajariladi (lifespan'da patches qayta ishlaydi)
- **Then** startup xatosiz tugaydi — `IF NOT EXISTS` idempotentligini ta'minlaydi

**Scenario 3 (boundary): `tasks` partial indeksi faqat ochiq tasklar uchun ishlaydi**
- **Given** `ix_tasks_org_open` indeksi `WHERE status NOT IN ('done', 'cancelled')` bilan
- **When** `SELECT 1 FROM pg_indexes WHERE indexname = 'ix_tasks_org_open'` bajariladi
- **Then** indeks mavjud; `done` statusdagi task uchun `EXPLAIN` da bu indeks ishlatilmaydi

---

### M3: `payment_transactions` unique constraint

**Scenario 1 (happy path): Turli provayder yoki tx_id bilan to'lov qabul qilinadi**
- **Given** `payment_transactions` da `(click, tx-001)` yozuvi bor
- **When** `(payme, tx-001)` yoki `(click, tx-002)` bilan yangi yozuv INSERT qilinadi
- **Then** INSERT muvaffaqiyatli — turli (provider, provider_tx_id) juftligi unique kafolati buzilmaydi

**Scenario 2 (negative): Bir xil (provider, provider_tx_id) juftligi ikki marta insert qilinmaydi**
- **Given** `payment_transactions` da `(click, tx-001)` yozuvi bor
- **When** `(click, tx-001)` bilan qayta INSERT uriniladi
- **Then** PostgreSQL `23505 unique_violation` xatosi qaytaradi — duplicate payment qabul qilinmaydi

**Scenario 3 (boundary): `provider_tx_id IS NULL` bo'lsa unique cheklov qo'llanmaydi**
- **Given** `uq_payment_tx_provider` indeksi `WHERE provider_tx_id IS NOT NULL` bilan yaratilgan
- **When** `provider_tx_id = NULL` bilan bir nechta yozuv INSERT qilinadi
- **Then** barcha INSERT muvaffaqiyatli — NULL yozuvlar unique tekshiruvdan o'tmaydi

---

## Talablar (RFC 2119)

### C1: `field::date` cast olib tashlash

- **MUST**: `finance/router.py`, `statistics/router.py`, `assistant/tools.py`, `manufacturing/router.py`, `mobile/router.py` da WHERE/AND/FILTER clauselardagi barcha `field::date` cast'lar olib tashlanishi shart.
- **MUST**: Replacement pattern: `field >= :df AND field < (:dt::date + INTERVAL '1 day')` (yoki `field >= :td AND field < (:td::date + INTERVAL '1 day')` bir kun uchun).
- **MUST NOT**: SELECT clauselardagi `field::date` cast'lar olib tashlanmasligi shart — ular display formatlash uchun va indeks'ga ta'sir qilmaydi.
- **MUST**: Har fayl uchun Grep bilan butun fayl tekshirilishi shart — bir fayl ichida bir nechta cast bo'lishi mumkin (sprint #2 dagi multi-location bug saboqi).
- **SHOULD**: `mobile/router.py:806` da `check_in_at < :dt::date + 1` pattern tekshirilsin va zarur bo'lsa tuzatilsin.

### C4: Composite indekslar

- **MUST**: Quyidagi 13 ta `CREATE INDEX IF NOT EXISTS` iborasi `apps/api/app/db/schema_patches.py` `PATCHES` ro'yxati oxiriga qo'shilishi shart:
  - `ix_invoices_org_date`, `ix_supplies_org_date`, `ix_purchase_orders_org_date`
  - `ix_customer_orders_org_date`, `ix_transfers_org_date`, `ix_sale_returns_org_date`
  - `ix_contracts_org_start`, `ix_inventories_org`
  - `ix_tasks_org_open` (partial: `WHERE status NOT IN ('done', 'cancelled')`)
  - `ix_tasks_assignee_open` (partial: `WHERE status NOT IN ('done', 'cancelled')`)
  - `ix_refresh_tokens_user_active` (partial: `WHERE revoked = FALSE`)
  - `ix_refresh_tokens_expires` (partial: `WHERE revoked = FALSE`)
  - `ix_user_invitations_expires` (partial: `WHERE accepted_at IS NULL AND cancelled_at IS NULL`)
- **MUST**: Har indeks `IF NOT EXISTS` bilan idempotent bo'lishi shart — lifespan'da xatosiz qayta ishlansin.
- **MUST**: Jadval yoki ustun mavjudligi avval tekshirilishi shart — mavjud bo'lmagan jadval uchun indeks yozilmasligi shart va ticket'da izoh qoldirilishi shart.
- **MUST NOT**: `infra/postgres/init.sql` ga to'g'ridan-to'g'ri yozilmasligi shart.
- **SHOULD NOT**: `CONCURRENTLY` ishlatilmasin — lifespan kontekstida transaksiya ichida ishlaydi.

### M3: `payment_transactions` unique constraint

- **MUST**: `uq_payment_tx_provider` UNIQUE INDEX `payment_transactions (provider, provider_tx_id) WHERE provider_tx_id IS NOT NULL` sifatida yaratilishi shart.
- **MUST**: Eski non-unique `idx_payment_tx_provider` indeksi mavjud bo'lsa DROP qilinishi shart.
- **MUST**: Yaratishdan oldin `SELECT provider, provider_tx_id, COUNT(*) FROM payment_transactions GROUP BY 1, 2 HAVING COUNT(*) > 1` bilan duplicate tekshiruvi o'tkazilishi shart — duplikat topilsa T-3 SKIP qilinsin va izoh qoldirilsin.
- **MUST**: Butun operatsiya `DO $$ BEGIN ... END $$` PL/pgSQL bloki ichida idempotent tarzda yozilishi shart.

### Test qamrovi (T-4)

- **MUST**: `ix_invoices_org_date` (va kamida 3 ta boshqa) indekslar mavjudligini `pg_indexes` orqali tekshiruvchi smoke testlar bo'lishi shart.
- **MUST**: `(click, tx-001)` ikki marta INSERT qilinganda `asyncpg.exceptions.UniqueViolationError` (yoki SQLAlchemy `IntegrityError`) ushlanishi shart.
- **MUST**: Mavjud 49+ test PASS bo'lishi shart.
- **SHOULD**: `EXPLAIN ANALYZE` orqali index scan ishlatilishini tekshiruvchi test (yoki fallback: status 200 + format tekshiruvi) bo'lishi shart.

---

## QILMAYMIZ (qamrov-tashqarisida)

- `schema_patches.py` dan alembic migration fayliga ko'chirish — bu alohida katta sprint
- `audit_log` partitioning — 100 org dan oshganda alohida baholanadi
- `organizations` soft-delete — UI o'zgartirish kerak, alohida sprint
- Money decimal scale o'zgartirish (`NUMERIC(20,4)` migration) — data migration talab qiladi, alohida sprint
- Row Level Security (RLS) yoqish — alohida xavfsizlik sprint
- `audit_log` async yozish — alohida arxitektura sprint
- Keyset pagination / OFFSET olib tashlash — alohida UX sprint
- Frontend UI o'zgarishlari — bu sprint faqat backend/DB
- Mavjud duplikat payment_transactions tozalash — agar topilsa alohida data cleanup sprint

---

## Rollback rejasi

- **C1 (cast olib tashlash)**: Git revert — kod o'zgarishi. DB'da hech qanday DDL o'zgarishi yo'q. Eski `::date` pattern'ga qaytish deployment orqali amalga oshiriladi. Funksional jihatdan teng — faqat performance farq.
- **C4 (indekslar)**: `DROP INDEX IF EXISTS ix_<name>` bilan teskari yo'nalishda olib tashlash mumkin. Indeks DROP lock-free (online) amalga oshiriladi. `schema_patches.py` dan qatorni olib tashlash kifoya — keyingi restart'da indeks qaytadan yaratilmaydi (chunki lifespan'da allaqachon bor bo'lsa `IF NOT EXISTS` o'tkazib yuboradi). Agar patch o'chirilsa va indeks qo'lda DROP qilinsa — tozalanadi.
- **M3 (unique index)**: `DROP INDEX IF EXISTS uq_payment_tx_provider` va eski `CREATE INDEX idx_payment_tx_provider ON payment_transactions (provider, provider_tx_id)` ni qaytadan yaratish. Bu operatsiya ham lock-free. Duplikat ma'lumot yo'q bo'lsa xavfsiz.

---

## Tegishli modullar

### Backend (o'zgartiriladigan fayllar)

- `apps/api/app/modules/finance/router.py` — C1: `sale_date::date` cast olib tashlash (qator 590, 593)
- `apps/api/app/modules/statistics/router.py` — C1: 11 ta `sale_date::date` cast (qatorlar 141, 197, 238, 262, 287, 333, 364, 428, 438, 446, 455)
- `apps/api/app/modules/assistant/tools.py` — C1: 2 ta cast (qator 45, 46)
- `apps/api/app/modules/manufacturing/router.py` — C1: `created_at::date` cast (qator 169, 172)
- `apps/api/app/modules/mobile/router.py` — C1: `check_in_at` pattern tekshiruv (qator 806)
- `apps/api/app/db/schema_patches.py` — C4 + M3: 13 ta yangi indeks + unique constraint patch

### Tests (yangi fayl)

- `apps/api/tests/test_db_schema_sprint3.py` — yangi fayl, ~10 ta test

### Tegmaydi

- `infra/postgres/init.sql` — TEGMAYDI
- `apps/web/` — TEGMAYDI (frontend bu sprintda tashqarida)
- `apps/api/app/modules/sale/router.py` — TEGMAYDI (sprint #2 da tuzatilgan)
- Alembic migration fayllar — TEGMAYDI

---

## O'zbek bozori xosligi

- **OFD**: tegmaydi — bu sprint DB performance va indeks
- **MXIK**: tegmaydi
- **QQS (NDS)**: tegmaydi
- **TIN/STIR**: tegmaydi
- **SMS (Eskiz.uz)**: tegmaydi
- **To'lov (Click/Payme)**: M3 bilvosita ta'sir qiladi — `payment_transactions` unique constraint Click va Payme webhook'larida duplicate to'lov kiritilishini DB darajasida bloklaydi. Webhook idempotency kafolati.

---

## Effort estimation

| Ticket | Mavzu | Owner | Effort |
|---|---|---|---|
| T-1 | C1: `field::date` cast olib tashlash (5 fayl, ~17 joy) | `backend-dev` | M (1.5-2 soat) |
| T-2 | C4: 13 ta composite/partial indeks `schema_patches.py` ga | `backend-dev` | S (30 daqiqa) |
| T-3 | M3: `payment_transactions` unique constraint | `backend-dev` | S (20 daqiqa) |
| T-4 | Tests: `test_db_schema_sprint3.py` (~10 ta test) | `backend-dev` | S (30 daqiqa) |
| **Jami** | | | **M (~3 soat)** |

## Tickets

- `tickets/T-1-date-cast-fix.md`
- `tickets/T-2-composite-indexes.md`
- `tickets/T-3-payment-tx-unique.md`
- `tickets/T-4-db-schema-tests.md`
