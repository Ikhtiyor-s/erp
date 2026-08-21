# SPEC — Backend xavfsizlik blok-fix paketi / Sprint #2 (2026-06-29)

> PM tomonidan yoziladi. Bu **PROPOSE** bosqichi.
> Format: `.claude/skills/openspec-format.md` ga qarang.

## Niyat

Aniq ERP production sotuvga chiqarish oldidan xavfsizlik auditi 4 ta CRITICAL (P0) va 7 ta HIGH
(P1) zaiflikni aniqladi. Bu zaifliklar real yuk ostida — tenant izolyatsiyasini buzadi,
privilege escalation'ga yo'l ochadi va RBAC qo'riqlovini bypass qilishga imkon beradi. Har
biri alohida ekspluatatsiya vektori bo'lib, SaaS multi-tenant kafolatini sindiradi. Bu to'plam
production deploy blokeri: birorta ham zaiflik ochiq qolsa, pilot mijoz onbordingi to'xtatiladi.
Sprint #2 maqsadi — hamma 4 CRITICAL va 7 HIGH ni yopish, har biri uchun regression test
yozish va mavjud 35 ta testni buzmasdan 0 BLOCKER bilan qa-reviewer tasdig'ini olish.

## Tegishli foydalanuvchi

- `superadmin` — global reference yozuvlari egasi; CR-4 to'g'ridan-to'g'ri ta'sir qiladi
- `admin` — org-level boshqaruv; CR-3, CR-4, HI-5, HI-6 ta'sir qiladi
- `manager` — sotuv va ombor; HI-1, HI-3 ta'sir qiladi
- `cashier` — kassa; HI-2, HI-3 ta'sir qiladi
- `customer` — customer portal OTP; HI-7 ta'sir qiladi
- Hamma autentifikatsiyalangan foydalanuvchilar — CR-1, CR-2 ta'sir qiladi (RBAC middleware)

## Acceptance criteria (Given/When/Then)

---

### CR-1: RBAC middleware fail-CLOSED

**Scenario 1 (happy path): Normal so'rov, DB bor**
- **Given** manager `Org A` da kirgan, DB muammosiz
- **When** `GET /api/v1/sale/orders` so'rov yuboriladi
- **Then** RBAC middleware permission'ni muvaffaqiyatli tekshiradi, 200 qaytadi

**Scenario 2 (negative): DB xato bo'lsa fail-CLOSED**
- **Given** RBAC middleware DB session'dan exception oladi (simulate: connection timeout)
- **When** ixtiyoriy himoyalangan endpoint'ga so'rov yuboriladi
- **Then** 503 Service Unavailable qaytadi, so'rov hech qachon handler'ga o'tmaydi
- **And** audit log'da `rbac_db_error` yozuvi mavjud

**Scenario 3 (boundary): Audit log yozilishi**
- **Given** DB xato simulate qilingan
- **When** so'rov rad etiladi
- **Then** `audit_logs` jadvalida `event_type = "rbac_check_failed"`, `org_id`, `path` yozilgan

---

### CR-2: Export/import/reports explicit permission mapping

**Scenario 1 (happy path): Explicit export permission bor foydalanuvchi**
- **Given** manager roli `sales.export` permission'iga ega
- **When** `GET /api/v1/sales/export` so'rovi yuboriladi
- **Then** 200 qaytadi, fayl yuklanadi

**Scenario 2 (negative): Faqat view permission bor, export yo'q**
- **Given** viewer roli `sales.view` bor, lekin `sales.export` yo'q
- **When** `GET /api/v1/sales/export` so'rovi yuboriladi
- **Then** 403 Forbidden qaytadi — fallback `.view` derive ISHLAMAYDI

**Scenario 3 (boundary): Middleware mapping table to'liqligi**
- **Given** `export`, `import`, `report` suffix'li barcha endpoint'lar ro'yxati
- **When** middleware permission derive qiladi
- **Then** har bir suffix `module.export` / `module.import` / `module.report` ga aniq map qilinadi, hech biri `module.view`'ga fallback qilmaydi

---

### CR-3: SKIP_PATHS tor qamrov

**Scenario 1 (happy path): `/organizations/list` RBAC'dan o'tadi (skip)**
- **Given** autentifikatsiyalangan foydalanuvchi
- **When** `GET /api/v1/organizations/list` so'rovi yuboriladi
- **Then** so'rov SKIP qilinadi, RBAC middleware tekshirmaydi

**Scenario 2 (negative): `/organizations/{id}/settings` RBAC'dan o'tishi shart emas**
- **Given** autentifikatsiyalangan foydalanuvchi, ixtiyoriy org ID
- **When** `GET /api/v1/organizations/{id}/settings` so'rovi yuboriladi
- **Then** RBAC middleware tekshiradi — skip QILINMAYDI, permission yo'q bo'lsa 403

**Scenario 3 (boundary): `/organizations/{id}/switch` o'ziga xos skip**
- **Given** foydalanuvchi tizimga kirgan, boshqa org'ga switch qilmoqchi
- **When** `POST /api/v1/organizations/{id}/switch` so'rovi yuboriladi
- **Then** bu endpoint SKIP listida aniq (explicit) ko'rsatilgan, RBAC o'tmaydi

---

### CR-4: Global reference superadmin-only write

**Scenario 1 (happy path): Superadmin global reference yozuvini o'zgartiradi**
- **Given** `is_superadmin = TRUE` foydalanuvchi
- **When** `PUT /api/v1/reference/{id}` so'rovi `organization_id IS NULL` yozuv uchun
- **Then** 200 qaytadi, yozuv yangilandi

**Scenario 2 (negative): Oddiy admin global reference'ni o'zgartirishga urinadi**
- **Given** `admin` roli bor, `is_superadmin = FALSE`, `organization_id = org_a`
- **When** `PUT /api/v1/reference/{global_id}` — `organization_id IS NULL` yozuv uchun
- **Then** 403 Forbidden qaytadi

**Scenario 3 (boundary): Admin o'z org reference yozuvini o'zgartiradi — ruxsat**
- **Given** `admin` roli, `organization_id = org_a`
- **When** `PUT /api/v1/reference/{own_org_record_id}` — `organization_id = org_a` yozuv
- **Then** 200 qaytadi — faqat o'z org yozuvlari o'zgartiriladi

---

### HI-1: create_sale cross-tenant entity tekshiruvi

**Scenario 1 (happy path): O'z org warehouse va products bilan sotuv**
- **Given** manager `Org A` da kirgan
- **When** `POST /api/v1/sale/orders` — `warehouse_id` va barcha `product_id`'lar `Org A` ga tegishli
- **Then** 201 qaytadi, sotuv yaratildi

**Scenario 2 (negative): Boshqa org warehouse bilan sotuv urinishi**
- **Given** manager `Org A` da kirgan
- **When** `warehouse_id = org_b_warehouse` bilan POST yuboriladi
- **Then** 422 qaytadi, xato: "warehouse_id boshqa tashkilotga tegishli"

**Scenario 3 (boundary): Aralash product_id — biri boshqa org**
- **Given** manager `Org A` da kirgan, `product_id_1` Org A'ga, `product_id_2` Org B'ga tegishli
- **When** ikkalasini o'z ichiga olgan sotuv yaratiladi
- **Then** 422 qaytadi, xato qaysi product_id begona ekanini ko'rsatadi

---

### HI-2: create_movement cross-tenant cashbox

**Scenario 1 (happy path): O'z org cashbox bilan harakatlanma**
- **Given** cashier `Org A` da kirgan
- **When** `POST /api/v1/finance/movements` — `cashbox_id` Org A'ga tegishli
- **Then** 201 qaytadi

**Scenario 2 (negative): Boshqa org cashbox bilan urinish**
- **Given** cashier `Org A`, `cashbox_id` Org B'ga tegishli
- **When** POST yuboriladi
- **Then** 422 qaytadi, "cashbox_id boshqa tashkilotga tegishli"

---

### HI-3: pay_sale cashbox + atomik tranzaksiya

**Scenario 1 (happy path): To'lov atomik amalga oshiriladi**
- **Given** manager `Org A`, sotuv `Org A` ga tegishli, cashbox ham `Org A` ga tegishli
- **When** `POST /api/v1/sale/orders/{id}/pay` so'rovi yuboriladi
- **Then** sale holati yangilandi VA cash_movements INSERT — ikkalasi bir tranzaksiyada, commit bo'ldi

**Scenario 2 (negative): Boshqa org cashbox — 422**
- **Given** manager `Org A`, `cashbox_id` Org B'ga tegishli
- **When** pay so'rovi yuboriladi
- **Then** 422 qaytadi, hech qanday DB o'zgarishi yo'q (rollback ishladi)

**Scenario 3 (boundary): cash_movements INSERT xato — sale UPDATE ham rollback**
- **Given** DB xato simulate qilingan (cash_movements INSERT paytida)
- **When** pay so'rovi yuboriladi
- **Then** sale holati o'zgarmaydi (rollback), atomik kafolat saqlanadi

---

### HI-4: import_customers xavfsiz bulk import

**Scenario 1 (happy path): 1500 qatorli fayl chunk'lab import**
- **Given** admin `Org A`, CSV 1500 mijoz
- **When** `POST /api/v1/customer/import` so'rovi yuboriladi
- **Then** 200 qaytadi, `imported: 1500, errors: 0`, session corruption yo'q

**Scenario 2 (negative): Noto'g'ri qator bor fayl — aniq xato xabari**
- **Given** CSV 100 qator, 47-qator invalid (telefon format noto'g'ri)
- **When** import so'rovi yuboriladi
- **Then** 422 qaytadi, `{"row": 47, "error": "invalid phone format"}`, 0 qator import qilinmaydi (rollback)

---

### HI-5: register admin roli org-scoped

**Scenario 1 (happy path): Yangi org ro'yxatdan o'tganda admin roli org'ga bog'liq**
- **Given** yangi tashkilot `POST /api/v1/auth/register` orqali yaratiladi
- **When** registratsiya muvaffaqiyatli
- **Then** yaratilgan user roli `organization_id = new_org_id` bilan saqlangan (global admin'ga link YO'Q)
- **And** `roles` jadvalida `organization_id IS NULL` bo'lgan global admin roli bilan bog'liq emas

**Scenario 2 (boundary): Ikki xil org'da alohida admin rollari**
- **Given** `Org A` va `Org B` ikkalasi ro'yxatdan o'tgan
- **When** Org A admin'ining roli Org B'da tekshiriladi
- **Then** Org B da hech qanday permission yo'q (izolatsiya to'liq)

---

### HI-6: update_role_permissions privilege escalation himoyasi

**Scenario 1 (happy path): Admin faqat o'zida bor permissionni qo'shadi**
- **Given** admin `Org A`, `sales.view` permission'i bor, `sales.export` yo'q
- **When** `PUT /api/v1/rbac/roles/{role_id}/permissions` — faqat `sales.view` qo'shadi
- **Then** 200 qaytadi, permission qo'shildi

**Scenario 2 (negative): Foydalanuvchi o'zida yo'q permissionni qo'shishga urinadi**
- **Given** admin `Org A`, `sales.view` bor, `settings.manage` yo'q
- **When** `settings.manage` ni boshqa rolga qo'shmoqchi
- **Then** 403 Forbidden qaytadi, permission qo'shilmaydi

**Scenario 3 (boundary): Superadmin cheklovsiz qo'sha oladi**
- **Given** `is_superadmin = TRUE`
- **When** ixtiyoriy permission ixtiyoriy rolga qo'shiladi
- **Then** 200 qaytadi (superadmin uchun self-check o'tkazilmaydi)

---

### HI-7: OTP telefon raqam normalizatsiya

**Scenario 1 (happy path): Normalized format bilan OTP so'rash**
- **Given** customer `+998901234567` bilan ro'yxatdan o'tgan
- **When** `POST /customer-portal/otp/request` — `{"phone": "+998901234567"}`
- **Then** OTP yuboriladi, `WHERE phone = :p` (LIKE emas) — aniq match

**Scenario 2 (negative): Prefix collision — eski LIKE pattern yo'q**
- **Given** DB da `+99890123456` va `+998901234567` ikkita yozuv bor
- **When** `+998901234567` uchun OTP so'raladi
- **Then** faqat bitta to'g'ri yozuv tanlanadi, prefix collision yo'q

**Scenario 3 (boundary): Turli formatda kiritilgan raqam normalize bo'ladi**
- **Given** customer `998901234567` (+ belgisiz) kiritadi
- **When** OTP so'rovi yuboriladi
- **Then** normalize funksiya `+998901234567` formatiga keltiradi va to'g'ri yozuv topiladi

---

## Talablar (RFC 2119)

### RBAC middleware (CR-1, CR-2, CR-3)

- **MUST**: RBAC middleware DB exception ushlanganda `return await call_next(request)` chaqirmasligi shart — 503 qaytarishi shart.
- **MUST**: DB exception hollarda audit log yozilishi shart (`event_type = "rbac_check_failed"`).
- **MUST**: `export`, `import`, `report` suffix'li path'lar uchun middleware aniq permission mapping table ishlatishi shart — `module.view`'ga fallback TAQIQLANGAN.
- **MUST**: SKIP_PATHS faqat quyidagilarni o'z ichiga olishi shart: `/api/v1/organizations/list`, `/api/v1/organizations/{id}/switch` — wildcard `organizations*` TAQIQLANGAN.
- **MUST NOT**: Middleware xato bo'lganda so'rov handler'ga o'tmasligi shart.

### Global reference (CR-4)

- **MUST**: `PUT` va `DELETE` endpoint'larda `organization_id IS NULL` yozuvlarga faqat `is_superadmin = TRUE` foydalanuvchi murojaat qila olishi shart.
- **MUST**: Oddiy admin `organization_id IS NULL` yozuvlarni o'zgartirmoqchi bo'lsa 403 qaytarishi shart.
- **MUST**: Admin o'z `organization_id` ga mos yozuvlarni o'zgartira olishi shart.

### Cross-tenant entity tekshiruvi (HI-1, HI-2, HI-3)

- **MUST**: `create_sale` da `warehouse_id` va barcha `product_id`'lar `organization_id = :o` bilan tekshirilishi shart — bir SQL query yoki sub-query'da.
- **MUST**: `create_movement` da `cashbox_id` `WHERE id = :cb AND organization_id = :o` bilan tekshirilishi shart.
- **MUST**: `pay_sale` da cashbox org tekshiruvi + `sale UPDATE` va `cash_movements INSERT` bitta DB tranzaksiyasida bo'lishi shart.
- **MUST**: Cross-tenant muvofiqsizlikda 422 qaytishi va xato xabarida qaysi field noto'g'ri ekanligi ko'rsatilishi shart.
- **MUST NOT**: Cross-tenant entity tekshiruvi o'tkazilmagan holda DB yozuv amalga oshirilmasligi shart.

### Bulk import (HI-4)

- **MUST**: Import 500 qatorli chunk'larda ishlashi shart — bitta katta INSERT TAQIQLANGAN.
- **MUST**: Xato bo'lsa rollback va qaysi row sabab ekanligi response'da ko'rsatilishi shart.
- **MUST NOT**: Qisman import (partial commit) bo'lmasligi shart — ya to'liq, ya rollback.

### Register admin roli (HI-5)

- **MUST**: Yangi tashkilot registratsiyasida yaratilgan admin roli `organization_id = new_org_id` bilan saqlanishi shart.
- **MUST NOT**: Yangi admin roli global `organization_id IS NULL` admin roli bilan bog'lanmasligi shart.

### Privilege escalation (HI-6)

- **MUST**: `update_role_permissions` da so'rov yuborgan foydalanuvchi faqat o'zida mavjud bo'lgan permission'larni boshqa rolga qo'sha olishi shart.
- **MUST NOT**: Foydalanuvchi o'zida yo'q permission'ni boshqa rolga qo'sha olmasligi shart — 403 qaytarishi shart.
- **SHOULD**: Superadmin uchun self-check o'tkazilmasin (istisnoli holat).

### OTP phone (HI-7)

- **MUST**: Telefon raqam normalize funksiyadan o'tkazilishi shart — barcha formatlardagi kiritish bir xil saqlangan formatga keltirilsin.
- **MUST**: OTP tekshiruvida `WHERE phone = :p` (aniq tenglik) ishlatilishi shart — `LIKE '%...%'` TAQIQLANGAN.
- **MUST**: Normalize format: `+998XXXXXXXXX` (12 ta belgi, faqat raqam, `+` prefix bilan).

### Test qamrovi (T-7)

- **MUST**: Har CR va HI uchun kamida bitta pytest async test bo'lishi shart.
- **MUST**: Cross-tenant test: boshqa org ID bilan so'rov → 403 yoki 404 yoki 422.
- **MUST**: Mavjud 35 ta test PASS bo'lishi shart.
- **SHOULD**: Yangi ~15 ta test qo'shilishi shart.

---

## QILMAYMIZ (qamrov-tashqarisida)

- Frontend UI o'zgarishlari — bu sprint faqat backend; UI tekshiruvlari alohida sprint
- Rate limiting Redis'ga ko'chirish — hozir in-memory, prod'da alohida ticket
- Alembic migration yozish — `schema_patches.py` yetarli (agar DDL o'zgarish bo'lmasa)
- RBAC UI (permission editor interfeysi) o'zgarishlari — faqat API darajasida himoya
- Click/Payme webhook xavfsizlik tekshiruvi — alohida payment sprint
- SMS (Eskiz) OTP delivery xavfsizligi — bu sprintda faqat DB query normalizatsiyasi
- Audit log UI — log yoziladi, lekin ko'rish UI alohida sprint
- Performance optimizatsiya (query planner, indekslar) — xavfsizlik fix avval, perf keyinroq
- Global reference DELETE endpoint superadmin cheklovi — faqat PUT/PATCH (DELETE alohida baholash kerak)
- Customer portal OTP throttle mexanizmi o'zgartirish — rate limit allaqachon mavjud (3/min)
- `password_reset` flow o'zgarishlari — bu sprint tashqarisida

---

## Rollback rejasi

- **Kod**: Har ticket alohida PR — har biri mustaqil revert qilinishi mumkin. T-1 (middleware) va T-2 (reference) ayniqsa izolatsiya qilingan.
- **DB**: Bu sprint DDL o'zgarishi KUTILMAYDI (faqat mantiqiy tekshiruvlar va query o'zgarishlari) — rollback faqat kod revert.
- **Agar CR-1 fix server xatolariga olib kelsa**: feature flag o'rniga `RBAC_FAIL_OPEN=true` env variable bilan `schema_patches.py`'da toggle qo'shilishi mumkin — lekin bu faqat oxirgi chora.
- **Agar HI-7 normalizatsiya mavjud foydalanuvchi telefon'larini topmaydigan bo'lsa**: normalizatsiya funksiyasi DB'dagi mavjud format bilan mos kelmasligi mumkin — oldin migration script bilan mavjud telefon raqamlarni normalize qilish kerak (T-6 da baholansin).

---

## Tegishli modullar

### Backend (o'zgartiriladigan fayllar)

- `apps/api/app/modules/rbac/middleware.py` — CR-1 (fail-CLOSED), CR-2 (explicit mapping), CR-3 (SKIP_PATHS)
- `apps/api/app/modules/reference/router.py` — CR-4 (superadmin-only global write)
- `apps/api/app/modules/sale/router.py` — HI-1 (cross-tenant entity check), HI-3 (pay_sale atomik + cashbox check)
- `apps/api/app/modules/finance/router.py` — HI-2 (cross-tenant cashbox check)
- `apps/api/app/modules/customer/router.py` — HI-4 (bulk import chunked)
- `apps/api/app/modules/auth/router.py` — HI-5 (org-scoped admin role)
- `apps/api/app/modules/rbac/router.py` — HI-6 (privilege escalation guard)
- `apps/api/app/modules/customer_portal/router.py` — HI-7 (phone normalize)
- `apps/api/app/modules/audit/middleware.py` — CR-1 audit log yozuvi uchun (audit event type qo'shilishi mumkin)

### Tests

- `apps/api/tests/test_rbac_middleware.py` — yangi fayl (CR-1, CR-2, CR-3)
- `apps/api/tests/test_reference.py` — yangi yoki mavjud (CR-4)
- `apps/api/tests/test_sale.py` — yangi cross-tenant scenariolar (HI-1, HI-3)
- `apps/api/tests/test_finance.py` — HI-2
- `apps/api/tests/test_customer.py` — HI-4
- `apps/api/tests/test_auth.py` — HI-5
- `apps/api/tests/test_rbac.py` — HI-6
- `apps/api/tests/test_customer_portal.py` — HI-7

### Infra (tegmaydi)

- `infra/postgres/init.sql` — TEGMAYDI
- `apps/web/` — TEGMAYDI (frontend bu sprintda tashqarida)
- `apps/api/app/db/schema_patches.py` — faqat agar DDL o'zgarish zarur bo'lsa (hozir kutilmaydi)

---

## O'zbek bozori xosligi

- **OFD**: tegmaydi — bu sprint RBAC va tranzaksiya qavati
- **MXIK**: tegmaydi
- **QQS (NDS)**: tegmaydi
- **TIN/STIR**: tegmaydi
- **SMS (Eskiz.uz)**: HI-7 bilvosita ta'sir qiladi — OTP SMS delivery to'g'ri telefon raqamga yuborilishi normalize qilingandan keyin kafolatlanadi
- **To'lov (Click/Payme)**: tegmaydi — webhook security alohida sprint

---

## Effort estimation

| Ticket | Mavzu | Owner | Effort |
|---|---|---|---|
| T-1 | CR-1 + CR-2 + CR-3: RBAC middleware | `backend-dev` | M (2-3 soat) |
| T-2 | CR-4: Global reference superadmin guard | `backend-dev` | S (1 soat) |
| T-3 | HI-1 + HI-2 + HI-3: Cross-tenant entity check | `backend-dev` | M (2-3 soat) |
| T-4 | HI-4 + HI-5: Import chunked + register org-scoped | `backend-dev` | M (2 soat) |
| T-5 | HI-6: Privilege escalation guard | `backend-dev` | S (1 soat) |
| T-6 | HI-7: OTP phone normalize | `backend-dev` | S (1 soat) |
| T-7 | Tests: har CR/HI uchun pytest async | `backend-dev` | M (2-3 soat) |
| **Jami** | | | **L (~12-15 soat)** |

## Tickets

- `tickets/T-1-rbac-middleware-fix.md`
- `tickets/T-2-reference-superadmin-guard.md`
- `tickets/T-3-cross-tenant-entity-checks.md`
- `tickets/T-4-import-register-fixes.md`
- `tickets/T-5-privilege-escalation-guard.md`
- `tickets/T-6-otp-phone-normalize.md`
- `tickets/T-7-security-tests.md`
