# T-208 — Idempotency-Key HTTP Header Middleware + Duplicate Protection

**Owner Role**: backend-dev
**Depends On**: none
**Blocks**: none
**Estimated Size**: M (1-3 kun)
**Priority**: P0
**TZ Reference**: Cross-cutting (POS offline sync, TZ-02)

---

## Rationale

POS offline rejimida xodim skanerlagan va navbatga yozilgan operatsiyalar internet tiklanganda server'ga yuboriladi. Agar server 200 qaytarmasdan ulanish uzilsa, client qayta yuboradi — natijada bir sotuv ikki marta yozilishi mumkin. `Idempotency-Key` header'i bu muammoni hal qiladi: client UUID yuboradi, server shu UUID bilan avvalgi muvaffaqiyatli javobni qaytaradi — takroriy operatsiya bajarilmaydi. POS, transfer, va xarid create endpoint'lar uchun kritik.

---

## Files Likely Touched

- **DB**: `apps/api/app/db/schema_patches.py` — `idempotency_keys` jadval
- **Backend middleware/decorator**: `apps/api/app/core/idempotency.py` — yangi modul
- **Backend**: `apps/api/app/main.py` — middleware ro'yxatiga qo'shish
- **Backend**: `apps/api/app/modules/sale/router.py` — decorator qo'shish
- **Backend**: `apps/api/app/modules/warehouse/router.py` — purchase/transfer endpoint'lariga
- **Tests**: `apps/api/tests/test_idempotency.py`

---

## Acceptance Criteria

### DB Schema
- [ ] `idempotency_keys(id BIGSERIAL PK, idempotency_key VARCHAR(128) NOT NULL, organization_id UUID NOT NULL, method VARCHAR(10), path VARCHAR(255), status_code INT, response_body JSONB, created_at TIMESTAMPTZ DEFAULT NOW())` — `CREATE TABLE IF NOT EXISTS`
- [ ] Unique index: `(organization_id, idempotency_key)`
- [ ] `created_at` — TTL uchun (cleanup job 24h+ eski yozuvlarni o'chiradi)

### Middleware/Decorator
- [ ] `apps/api/app/core/idempotency.py` — `IdempotencyMiddleware` yoki `idempotent` decorator
- [ ] Qo'llanilish: faqat `POST`, `PATCH`, `DELETE` metodlari uchun (GET/HEAD skip)
- [ ] Header `Idempotency-Key` yo'q bo'lsa — oddiy o'tkazib yuborish (mandatory emas)
- [ ] Header bor bo'lsa:
  1. `SELECT response_body, status_code FROM idempotency_keys WHERE organization_id = :o AND idempotency_key = :key`
  2. Topilsa: `status_code` va `response_body` ni qaytaradi, endpoint CHAQIRILMAYDI
  3. Topilmasa: endpoint chaqiriladi, response `idempotency_keys`ga yoziladi
- [ ] Agar birinchi request hali davom etayotganda ikkinchisi kelsa (race) — 202 Accepted yoki 429 "Processing" (pessimistic: lock row bilan)
- [ ] Header qiymati validatsiya: UUID format, max 128 char; noto'g'ri format → 422

### Endpoint Coverage
Kamida quyidagi endpointlarda ishlashi shart:
- [ ] `POST /sale/sales` — sotuv yaratish
- [ ] `POST /sale/sales/{id}/confirm` — sotuv tasdiqlash
- [ ] `POST /warehouse/purchases` — xarid yaratish
- [ ] `POST /warehouse/internal-transfers` — ko'chirish yaratish
- [ ] `POST /warehouse/supplier-returns` (T-202) — ta'minotchi qaytarish

### Tests
- [ ] `test_idempotency.py`: bir xil key bilan ikki marta `POST /sale/sales` → ikkinchisi cached javob qaytaradi (DB'da bitta yozuv)
- [ ] `test_idempotency.py`: boshqa org'dan shu key → alohida hisob (izolatsiya)
- [ ] `test_idempotency.py`: `GET` bilan key — skip, har doim fresh javob
- [ ] `test_idempotency.py`: 25h o'tgach — eski key yangi yozuv sifatida qabul qilinadi (TTL cleanup)
- [ ] `test_idempotency.py`: noto'g'ri UUID format → 422

---

## Technical Notes

- **Antipattern**: barcha endpoint'larga avtomatik middleware sifatida qo'llash — faqat state-changing, non-idempotent endpointlarga. `GET`, audit, va stats endpoint'lardan o'tkazib yuboring.
- Response body JSONB'da saqlanadi — katta response'lar (Excel, PDF) bu yo'lga kirmasin. Agar `Content-Type: application/octet-stream` — skip.
- TTL cleanup: `DELETE FROM idempotency_keys WHERE created_at < NOW() - INTERVAL '24 hours'` — bu ticketda background scheduler shart emas, startup'da yoki cron sifatida keyinchalik.
- Race condition: `INSERT ... ON CONFLICT (organization_id, idempotency_key) DO NOTHING RETURNING id` — agar 0 row returned → boshqa process yozmoqda, 202 qayt.
- `SENSITIVE_KEYS` ro'yxatiga `idempotency_key` qo'shing — audit log'da raw key ko'rinmaydi (ihtiyoriy lekin yaxshi amaliyot).

---

## Definition of Done

- [ ] Mechanical: `pytest apps/api/tests/test_idempotency.py -v` — 0 fail
- [ ] Mechanical: barcha avvalgi testlar regression yo'q
- [ ] Agentic: qa-reviewer BLOCKER yo'q
- [ ] Behavioral: Postman — bir xil UUID key bilan ikki `POST /sale/sales` — ikkinchisi 200 + cached response, DB'da bitta sotuv
- [ ] Human-gate: merge
