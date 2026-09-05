# T-206 — cashboxes.warehouse_id + POS-Sklad Bog'lanishi + TZ-02 Qoidasi

**Owner Role**: both (backend-dev + frontend-dev)
**Depends On**: none
**Blocks**: none
**Estimated Size**: S (< 1 kun)
**Priority**: P0
**TZ Reference**: TZ-02

---

## Rationale

POS (kassa nuqtasi) hozirda to'g'ridan-to'g'ri biron skladsga bog'liq emas — `cashboxes.warehouse_id` ustuni yo'q. Sotuv paytida sklad menejer tomonidan qo'lda tanlanadi. Bu hato qilish imkonini beradi: kassa A (do'kon front) uchun sklad B (ombor) tanlash mumkin. TZ-02 qoidasi: har kassa o'zining birlamchi sklad'iga bog'liq bo'lishi, POS sotuv yaratilganda ushbu sklad avtomatik default bo'lishi kerak.

---

## Files Likely Touched

- **DB**: `apps/api/app/db/schema_patches.py` — `cashboxes.warehouse_id` ustun
- **Backend**: `apps/api/app/modules/finance/router.py` — cashbox GET/POST/PATCH endpoint'lari
- **Backend**: `apps/api/app/modules/sale/router.py` — sotuv yaratishda default warehouse logikasi
- **Frontend**: `apps/web/app/(dashboard)/settings/devices/page.tsx` — kassa sozlamasida sklad tanlash
- **i18n**: `apps/web/i18n/messages/uz.json`, `ru.json`, `en.json`
- **Tests**: `apps/api/tests/test_cashbox_warehouse.py`

---

## Acceptance Criteria

### DB Schema
- [ ] `ALTER TABLE cashboxes ADD COLUMN IF NOT EXISTS warehouse_id INT REFERENCES warehouses(id)` — nullable (eski kassalar bor, majburiy emas)
- [ ] Index: `(organization_id, warehouse_id)`

### Backend
- [ ] `GET /finance/cashboxes` response'da `warehouse_id` va `warehouse_name` maydoni mavjud (JOIN warehouses)
- [ ] `POST /finance/cashboxes` body'da `warehouse_id` ixtiyoriy maydon sifatida qabul qiladi
- [ ] `PATCH /finance/cashboxes/{id}` `warehouse_id` yangilash imkoni
- [ ] Agar `warehouse_id` berilsa, u `organization_id` ga tegishli ekanligini tekshiriladi (403 aks holda)
- [ ] `POST /sale/sales` body'da `warehouse_id` yo'q va `cashbox_id` bor bo'lganda: `cashbox.warehouse_id` sukut bo'yicha warehouse sifatida ishlatiladi
- [ ] Agar xodimda `sale.change_warehouse` permission bo'lsa — body'dagi `warehouse_id` override sifatida qabul qilinadi
- [ ] Agar `cashbox.warehouse_id` ham yo'q, body'da ham yo'q — 422 "warehouse_id required"

### Frontend
- [ ] `settings/devices/page.tsx` — kassa yaratish/tahrirlash modal'ida "Sklad" dropdown qo'shiladi (warehouses ro'yxati)
- [ ] Dropdown faqat faol skladslarni ko'rsatadi
- [ ] Mavjud kassalar uchun warehouse tanlanmagan bo'lsa "Tanlanmagan" placeholder

### Tests
- [ ] `test_cashbox_warehouse.py`: cashbox `warehouse_id` bilan yaratiladi, GET'da ko'rinadi
- [ ] `test_cashbox_warehouse.py`: sotuv yaratishda cashbox warehouse'i avtomatik tanlanadi
- [ ] `test_cashbox_warehouse.py`: boshqa org warehouse'i → 422/403

---

## Technical Notes

- `warehouse_id` `INT` emas, `warehouses.id` tipiga qarab (init.sql'da `SERIAL` bo'lsa INT, `UUID` bo'lsa UUID) — init.sql'ni tekshiring va mos tip ishlating.
- **Antipattern**: `warehouse_id` ni majburiy (NOT NULL) qilmang — mavjud kassalar migrate qilinmagan bo'lishi mumkin, gradual migration kerak.
- `sale.change_warehouse` permission mavjud emasligini tekshiring — yo'q bo'lsa `permissions.py`ga qo'shing va seed'da admin, manager'ga grant qiling.
- `open_tickets.warehouse_id` allaqachon bor — bu yerda cashbox darajasida default o'rnatiladi, open_ticket ochilganda undan foydalanamiz.

---

## Definition of Done

- [ ] Mechanical: `pytest apps/api/tests/test_cashbox_warehouse.py -v` — 0 fail
- [ ] Mechanical: `psql -c "\d cashboxes"` — `warehouse_id` ustun ko'rinadi
- [ ] Agentic: qa-reviewer BLOCKER yo'q
- [ ] Behavioral: settings → devices → kassani tahrirlash → sklad tanlanadi → saqlash → kassa kartasida sklad nomi ko'rinadi
- [ ] Human-gate: merge
