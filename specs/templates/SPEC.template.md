# SPEC — <feature name> (YYYY-MM-DD)

> PM tomonidan yoziladi. Bu **PROPOSE** bosqichi.
> Format: `.claude/skills/openspec-format.md` ga qarang.

## Niyat (1 abzats)

Muammo, kim uchun, nega hozir.

> Misol: "Chakana savdo do'konlarida MXIK kod soliq talabi. Hozir products jadvalida bu field yo'q — kassir o'zicha qo'shimcha matn yozishi kerak. Kerakli foydalanuvchilar: kassir va kelajakda OFD integratsiyasi."

## Tegishli foydalanuvchi

Aniq role(s): `admin` | `manager` | `kassir` | `mijoz` | `agent` | ...

## Acceptance criteria (Given/When/Then)

**Scenario 1: Happy path — MXIK product create**
- **Given** admin tashkilotda mavjud va `warehouse.create` ruxsatga ega
- **When** POST /api/v1/warehouse/products body `{"name": "Choy", "mxik": "0902103000"}`
- **Then** 201 javob va `mxik` field response'da
- **And** DB'da `products.mxik = '0902103000'`

**Scenario 2: Validation — invalid MXIK length**
- **Given** ...
- **When** POST body `{"mxik": "123"}` (too short)
- **Then** 422 javob "MXIK kamida 10 raqamdan iborat bo'lsin"

**Scenario 3: Cross-tenant isolation**
- **Given** Org A va Org B
- **When** Org B admin Org A'ning product'ini GET qilmoqchi
- **Then** 404 yoki 403 (tenant leak yo'q)

## Talablar (RFC 2119)

- **MUST**: Sistema MXIK code'ni `products.mxik VARCHAR(20)` ustunida saqlashi shart
- **MUST**: API request va response uchun `mxik` field optional bo'lsin (`null` qabul qilinadi)
- **MUST NOT**: Sistema MXIK code'ni boshqa org'ga ko'rsatmasligi shart (organization_id filter)
- **SHOULD**: Sistema MXIK code'ni 10-17 raqam ekanligini tekshirsin
- **MAY**: Sistema mxik.uz API orqali kelajakda real-time validatsiya qilishi mumkin (out-of-scope)

## QILMAYMIZ (qamrov-tashqarisida)

- ❌ MXIK lookup avto-to'ldirish — keyingi sprint
- ❌ mxik.uz API integratsiyasi — alohida talab
- ❌ Mavjud productlarni avto-backfill MXIK bilan — qo'lda admin to'ldiradi
- ❌ Receipt PDF'da MXIK qatorini ko'rsatish — alohida ticket (agar kerak bo'lsa)
- ❌ Soliq deklaratsiyasi format — XL effort, alohida feature

## Rollback rejasi

- **DB**: `ALTER TABLE products DROP COLUMN mxik` — column drop forward-only, lekin nullable bo'lganligi sababli `=NULL` ham xavfsiz
- **Code**: revert PR
- **User-facing**: form field yashirish (feature flag yo'q — frontend simple revert)
- **Data**: backfill yo'q — saqlash mumkin (default NULL)

## Tegishli modullar

- `apps/api/app/modules/warehouse/router.py` — products CRUD endpointlari
- `apps/api/app/db/schema_patches.py` — ALTER TABLE patch
- `apps/web/app/(dashboard)/warehouse/products/page.tsx` — product form
- `apps/web/lib/menu.config.ts` — (o'zgarmaydi — mavjud)

## O'zbek bozori xosligi

- **OFD**: ✗ tegmaydi bu sprintda (P0-1 alohida)
- **MXIK**: ✓ asosiy mavzu — Soliq qo'mitasi talab
- **QQS**: ✗ tegmaydi (P0-3 alohida)
- **TIN/STIR**: ✗ tegmaydi
- **SMS (Eskiz)**: ✗ tegmaydi
- **To'lov**: ✗ tegmaydi

## Effort estimation

- Backend: S (1-2 hours)
- Frontend: S (1-2 hours)
- Total: ~3-4 hours

## Tickets

PM 3 ta ticket yaratadi (T-1, T-2, T-3) — pastdagi ko'rinishda:
- `T-1-add-mxik-column.md` (backend, schema)
- `T-2-mxik-form-field.md` (frontend)
- `T-3-mxik-validation.md` (backend, validation)
