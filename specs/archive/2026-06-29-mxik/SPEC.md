# SPEC — MXIK field mahsulot jadvaliga qo'shish (2026-06-29)

> PM tomonidan yoziladi. Bu **PROPOSE** bosqichi.
> Format: `.claude/skills/openspec-format.md` ga qarang.

## Niyat

O'zbekiston Soliq qo'mitasi har sotilgan mahsulot uchun MXIK (Mahsulot va Xizmatlar
Identifikatsiya Kodi) majburiy ekanligini talabi mavjud — OFD fiskal chekida bu kod bo'lmasa
chek noto'g'ri hisoblanadi. Hozir `products` jadvalida `mxik` ustuni yo'q: kassirlar kodni
qo'l bilan qo'shimcha matn sifatida yozishga majbur yoki umuman bo'sh qoldiradi. Bu pre-MVP
blocker (P0-2) — savdo moduli OFD integratsiyasiga ulanganda field tayyor bo'lishi shart.
Shu sprintda minimal yechim: `products` jadvalga `mxik VARCHAR(20)` qo'shish, Pydantic
schema va frontend form'ni yangilash. OFD integratsiyasining o'zi alohida sprintga (P0-1)
qoldiriladi.

## Tegishli foydalanuvchi

- `admin` — mahsulot yaratish va tahrirlash (asosiy foydalanuvchi)
- `manager` — mahsulot tahrirlash (MXIK to'ldiradi)
- `cashier` — mahsulotni ko'rish (o'qish ruxsati bor, lekin MXIK field'ni to'ldirmaydi bu
  sprintda)

## Acceptance criteria (Given/When/Then)

**Scenario 1: Happy path — MXIK bilan mahsulot yaratish**
- **Given** admin `Org A` da tizimga kirgan va `warehouse.create` ruxsatiga ega
- **When** `POST /api/v1/warehouse/products` so'rovi yuboriladi, body: `{"name": "Choy
  \"Aqlli\"", "mxik": "0902103000", ...}`
- **Then** 201 javob qaytadi va response body'da `"mxik": "0902103000"` mavjud
- **And** PostgreSQL `products` jadvalida `mxik = '0902103000'` saqlangan
- **And** `organization_id` shu admin'ning tashkilotiga tegishli

**Scenario 2: Happy path — MXIK bo'lmasdan mahsulot yaratish (nullable)**
- **Given** admin `Org A` da tizimga kirgan va `warehouse.create` ruxsatiga ega
- **When** `POST /api/v1/warehouse/products` so'rovi yuboriladi, body'da `mxik` field yo'q yoki
  `null`
- **Then** 201 javob qaytadi — `"mxik": null` response'da
- **And** DB'da `mxik IS NULL`

**Scenario 3: Negative — noto'g'ri formatdagi MXIK**
- **Given** admin tizimga kirgan
- **When** `POST /api/v1/warehouse/products` so'rovida `{"mxik": "123"}` (3 ta raqam — juda
  qisqa)
- **Then** 422 Unprocessable Entity qaytadi
- **And** xato xabari: MXIK 10 dan 17 gacha raqamdan iborat bo'lishi shart
- **And** mahsulot DB'ga saqlanmaydi

**Scenario 4: Negative — harfli MXIK**
- **Given** admin tizimga kirgan
- **When** `POST /api/v1/warehouse/products` so'rovida `{"mxik": "ABC1234567"}` (harf bor)
- **Then** 422 Unprocessable Entity qaytadi
- **And** xato xabari: MXIK faqat raqamlardan iborat bo'lishi shart
- **And** mahsulot DB'ga saqlanmaydi

**Scenario 5: Cross-tenant chegarasi — boshqa org mahsulotini ko'rishga urinish**
- **Given** `Org A` admini kirgan, `Org B` da `mxik = '1234567890'` bilan mahsulot bor
- **When** `Org A` admini `GET /api/v1/warehouse/products/{org_b_product_id}` so'rovini yuboradi
- **Then** 404 javob qaytadi
- **And** `Org B` ning mahsulot ma'lumotlari (shu jumladan MXIK) hech qachon `Org A` ga
  ko'rinmaydi

## Talablar (RFC 2119)

- **MUST**: `products` jadvalida `mxik VARCHAR(20) NULL` ustuni bo'lishi shart (schema_patches
  yoki alembic migration orqali, `IF NOT EXISTS` bilan idempotent)
- **MUST**: `mxik` qiymat kiritilganda faqat raqam (digit) bo'lishi va uzunligi 10–17 belgidan
  iborat bo'lishi shart (Pydantic validator)
- **MUST**: `mxik` field optional bo'lishi shart — `null` qabul qilinadi (`None` Python'da)
- **MUST**: Barcha products endpoint'lari `WHERE organization_id = :o` filtri orqali o'tishi
  shart — cross-tenant leak ruxsat etilmaydi
- **MUST**: Product create va update response'larida `mxik` field qaytarilishi shart
- **MUST NOT**: `mxik` field audit log'da redact qilinmasligi shart — bu ommaviy ma'lumotnoma
  kodi, maxfiy emas
- **MUST NOT**: `infra/postgres/init.sql` fayli bevosita tahrir qilinmasligi shart — migration
  `schema_patches.py` yoki `alembic/` orqali
- **SHOULD**: Frontend product table'da `MXIK` ustuni ko'rsatilishi kerak (desktop view'da,
  mobile card view'da ham qisqa ko'rinishi)
- **SHOULD**: Frontend product yaratish va tahrirlash modal'larida `MXIK` input field bo'lishi
  kerak — placeholder `"Masalan: 0902103000"` bilan
- **SHOULD**: Frontend validatsiya xatosi foydalanuvchiga sonner `toast.error` orqali
  ko'rsatilishi kerak (`getErrorMessage` yordamida)
- **MAY**: Kelajakda `mxik.uz` API orqali real-time validatsiya qo'shilishi mumkin — bu
  sprintda emas

## QILMAYMIZ (qamrov-tashqarisida)

- MXIK avto-to'ldirish (mxik.uz API lookup) — keyingi alohida sprint, API kalit va rate
  limit muammolari bor
- OFD integratsiyasi — P0-1 sifatida belgilangan, vendor bilan alohida shartnoma talab qiladi,
  XL effort
- Fiskal chek (receipt) PDF'ga MXIK qatorini chiqarish — receipt modul alohida ticket talab
  qiladi
- Mavjud mahsulotlarga MXIK backfill (avto-to'ldirish) — admin qo'lda to'ldiradi, skript
  kerak emas
- QQS (NDS) hisobi va soliq deklaratsiyasi — alohida modul (P0-3)
- MXIK bo'yicha filter/qidiruv API endpoint — bu sprintda amaliy ehtiyoj yo'q

## Rollback rejasi

- **DB**: `ALTER TABLE products DROP COLUMN IF EXISTS mxik;` — ustun nullable bo'lganligi
  sababli mavjud ma'lumotlarga ta'sir yo'q. Lekin drop qilsa kiritilgan MXIK qiymatlar
  yo'qoladi. Schema patch idempotent yoziladi (`IF NOT EXISTS`).
- **Kod**: PR revert — backend va frontend o'zgarishlari bitta PR'da bo'lsa, bitta revert
  yetarli
- **User-facing**: Frontend form field yashirish (feature flag yo'q — simple revert yoki
  `hidden` className qo'shish)
- **Data loss xatari**: minimal — `mxik` column nullable, drop qilmasdan turib revert
  qilinganda NULL qiymatlar saqlanib qoladi

## Tegishli modullar

### Backend

- `apps/api/app/db/schema_patches.py` — `ALTER TABLE products ADD COLUMN IF NOT EXISTS mxik
  VARCHAR(20)` patch qo'shiladi (PATCHES listiga oxiridan)
- `apps/api/app/modules/warehouse/schemas.py` — `ProductCreate`, `ProductUpdate`,
  `ProductOut` Pydantic modellariga `mxik: str | None = None` va validator qo'shiladi
- `apps/api/app/modules/warehouse/router.py` — mavjud create/update endpointlari schema
  o'zgarishini "avtomatik" qabul qiladi; alohida endpoint kerak emas
- `apps/api/tests/test_warehouse.py` — yangi test funksiyalari (T-3)

### Frontend

- `apps/web/app/(dashboard)/warehouse/products/page.tsx` — product table'ga MXIK ustuni,
  create/edit modal'larga MXIK input field
- `apps/web/i18n/messages/uz.json`, `ru.json`, `en.json`, `uz-cyrl.json` — `"mxik"` va
  `"mxik_placeholder"` tarjima kalitlari

### Infra (tegmaydi)

- `infra/postgres/init.sql` — TEGMAYDI (baseline, o'zgartirish taqiqlangan)
- `apps/web/lib/menu.config.ts` — TEGMAYDI (yangi menu element kerak emas)

## O'zbek bozori xosligi

- **OFD (Online Fiskal Daftarxona)**: bu sprintda tegmaydi — P0-1 alohida vendor
  integratsiyasi. MXIK field saqlanishi OFD'ga ulanganda tayyor bo'ladi.
- **MXIK**: asosiy mavzu. O'zbekiston Soliq qo'mitasi majburiy talab. Kod 10–17 raqamli
  identifikator, `mxik.uz` rasmiy ma'lumotnomasi mavjud.
- **QQS (NDS)**: tegmaydi — alohida modul P0-3.
- **TIN/STIR**: tegmaydi.
- **SMS (Eskiz.uz)**: tegmaydi.
- **To'lov (Click/Payme)**: tegmaydi.

## Effort estimation

| Ticket | Owner | Effort |
|---|---|---|
| T-1: Backend column + validation | `backend-dev` | S (1–2 soat) |
| T-2: Frontend form field + table column | `frontend-dev` | S (1–2 soat) |
| T-3: Backend tests | `backend-dev` | S (1 soat) |
| **Jami** | | **~3–5 soat** |

## Tickets

- `tickets/T-1-mxik-backend-column.md`
- `tickets/T-2-mxik-frontend-ui.md`
- `tickets/T-3-mxik-backend-tests.md`
