# Production Readiness — Aniq ERP (2026-06-29)

## Bajarilgan ishlar (3 sprint)

### Sprint #2 — Backend xavfsizlik (4 cycle, APPROVED)
- 4 CRITICAL + 7 HIGH = 11 ta multi-tenant leak fixed
- RBAC middleware fail-CLOSED, cross-tenant entity checks, OTP phone normalize, privilege escalation guard
- 14 yangi test, jami 49 PASS

### Sprint #3 — DB schema CRITICAL (3 cycle, APPROVED)
- 17 ta `field::date` WHERE cast olib tashlandi (5 fayl) — `(:param::type)` asyncpg incompat fundamental bug
- 13 yangi composite/partial indeks (invoices, supplies, transfers, tasks, refresh_tokens, invitations)
- `payment_transactions` UNIQUE constraint (webhook idempotency)
- 19 yangi test, jami 68 PASS

### Sprint #4 — Frontend UX HIGH (2 cycle, APPROVED)
- 25+ sahifa responsive grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-N`)
- 7 sahifa mobile card pattern
- 35+ fayl `getErrorMessage` migration
- Portal modallar `<Modal>` (focus trap, Esc, role=dialog)
- POS touch targets 44px, 4 mobile error handling
- Field `htmlFor`, 47 aria-label
- TypeScript build 0 errors

## Hozirgi holat — production'ga ko'tarish

### ✅ Tayyor pilot uchun (1-3 mijoz)

**Tayyor segmentlar:**
- Kichik B2B distribution (5-15 xodim)
- Servis kompaniya / repair shop
- Online sotuvchi (Telegram-do'kon — Click/Payme real)

**Texnik asos:**
- Multi-tenant izolyatsiya 100%
- RBAC mustahkam (fail-CLOSED, privilege escalation guarded)
- Sirlar Fernet at-rest
- Audit log redaction
- Backup/restore rotation + S3
- Sentry opt-in
- DB indekslar 1000 org'gacha kafolatlangan tezlik

### ⚠️ MVP — keng bozor uchun hali tayyor emas

**Sotuvga chiqarish blokerlari (XL, 3-4 hafta har biri, tashqi integrator/sertifikat shart):**

1. **OFD/online fiscal** (`ofd.soliq.uz`) — kafe, do'kon, retail (bozorning 60%+) **bugun sotib ololmaydi**
2. **E-faktura `my.tax.uz`** — yurik shaxs B2B QQS to'lovchi mijozlar (25%)
3. **QQS hisobi to'liq** — `vat_rate`, `vat_amount` ustunlar, deklaratsiya export

**Boshqa orqada qolgan:**
4. Bank statement import (1C format) — Kapitalbank/NBU/Asaka
5. Onboarding wizard + subscription enforcement
6. Payroll (oylik maosh, INPS, ENPF, DSF)
7. STIR/INN reestri lookup (`data.gov.uz`)
8. ESC/POS print agent
9. 2FA TOTP
10. Rate limit Redis (in-memory → multi-worker false)

## Backlog (prioritetlangan)

### Sprint #5 — Quick wins (1 hafta)
- Subscription page grid responsive (1 fayl, 5 daqiqa)
- PDF chek MXIK column (sale/pdf.py)
- Onboarding default seed (yangi org'ga UZS + warehouse + cashbox + naqd payment)
- Rate limit Redis migration
- Cleanup cron (refresh_tokens, customer_otp_codes, user_invitations)
- T-3 migration qolgan ~28 fayl (warehouse, settings, supply, reference)
- Mobile m/ 4 fayl error handling

### Sprint #6 — Tax compliance MVP (3-4 hafta)
- OFD integratsiya boshlanishi (`ofd.soliq.uz` API, `fiscal.uz` yoki shunga o'xshash hamkorlik)
- MXIK PDF chek + sale_items MXIK ko'rinishi
- QQS column'lar (products.vat_rate, sale_items.vat_amount)

### Sprint #7 — E-faktura (3-4 hafta)
- `my.tax.uz` XML schema
- `.pfx` ED imzo integratsiyasi
- Draft → Send → Accept flow

### Sprint #8 — Bank + payroll (2 hafta)
- Bank statement parser (Kapital, NBU, Asaka)
- Payroll (INPS 12%, ENPF 0.1%, DSF 12%)

### Backlog — Differensiyatsiya
- 2FA TOTP (2 kun)
- Apelsin to'lov qaytarish (1 hafta)
- Batch/expiry tracking (dorixona, oziq-ovqat)
- Multi-level BOM + MRP
- Marketplace integration (Uzum, Yandex Market)
- AI assistant real tools

## Texnik qarz

1. **schema_patches.py 918 qator** — production deploy uchun alembic'ga ko'chirish
2. **audit_log partitioning** — 100+ org'da kerak (oylik partition + pg_partman)
3. **Audit log async** — har request middleware DB session sekinlashtiradi
4. **OFFSET pagination** 8 routerda — keyset (cursor) ga ko'chirish
5. **organizations soft-delete** — accidental destruction xavfini kamaytirish
6. **NUMERIC(20,2)** prices/rates → NUMERIC(20,4) (foreign currency precision)

## Validation savollari (3 sprint umumlashtirilgan)

1. ✅ Multi-tenant izolyatsiya buzilmadi
2. ✅ RBAC fail-CLOSED + privilege escalation guarded
3. ✅ Cross-tenant entity mutations bloklangan
4. ✅ DB indekslar 1000 org'gacha
5. ⚠️ Tax compliance (OFD/e-faktura/QQS) — alohida sprintda
