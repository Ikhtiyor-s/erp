# T-202 — supplier_returns Jadval + Endpoint + Moliya Integratsiya

**Owner Role**: both (backend-dev + frontend-dev)
**Depends On**: T-200 (stock_movements journal)
**Blocks**: none
**Estimated Size**: L (3-5 kun)
**Priority**: P0
**TZ Reference**: TZ-10

---

## Rationale

Hozirda ta'minotchiga qaytarish (supplier return) funksionaliteti umuman yo'q. Sotib olingan tovar noto'g'ri yetkazilsa, yoki sifatsiz bo'lsa, menejer uni faqat "spisanie" (write-off) sifatida yo'qotishi mumkin — bu moliyaviy hisobda ta'minotchi haqi sifatida emas, yo'qotish sifatida yoziladi. Natijada qarz-kredit balansi noto'g'ri, ta'minotchi munosabatlari buziladi. `supplier_returns` jadvali va to'liq workflow bu muammoni bartaraf etadi.

---

## Files Likely Touched

- **DB**: `apps/api/app/db/schema_patches.py` — `supplier_returns`, `supplier_return_items` jadvallar
- **Backend**: `apps/api/app/modules/warehouse/router.py` — yangi endpoint guruh
- **Backend service**: `apps/api/app/modules/warehouse/service.py` — `_stock_apply` chaqiruvi
- **Backend finance**: `apps/api/app/modules/finance/router.py` — refund moliya integratsiya
- **RBAC**: `apps/api/app/modules/rbac/permissions.py` — `warehouse.manage_supplier_returns`
- **RBAC seed**: `apps/api/app/modules/rbac/seed.py`
- **Frontend**: `apps/web/app/(dashboard)/supply/supplier-returns/page.tsx` — yangi sahifa
- **Frontend menu**: `apps/web/lib/menu.config.ts` — yangi menu elementi
- **i18n**: `apps/web/i18n/messages/uz.json`, `ru.json`, `en.json`
- **Tests**: `apps/api/tests/test_supplier_returns.py`

---

## Acceptance Criteria

### DB Schema
- [ ] `supplier_returns(id UUID PK, organization_id UUID NOT NULL, supplier_id UUID NOT NULL, warehouse_id INT NOT NULL, original_purchase_id UUID NULLABLE, doc_number VARCHAR(50), reason TEXT, status VARCHAR(20) DEFAULT 'draft', refund_amount NUMERIC(20,2) DEFAULT 0, refund_method VARCHAR(30), created_by UUID, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)`
- [ ] `supplier_return_items(id BIGSERIAL PK, supplier_return_id UUID FK, product_id UUID, quantity NUMERIC(20,3), unit_cost NUMERIC(20,4), amount NUMERIC(20,2) GENERATED)`
- [ ] `status` qabul qiluvchi qiymatlar: `draft`, `awaiting_shipment`, `shipped`, `completed`, `cancelled`
- [ ] `refund_method` qabul qiluvchi qiymatlar: `cash_refund`, `supplier_balance`, `replacement`
- [ ] Index: `(organization_id, status)`, `(organization_id, supplier_id)`

### Backend Endpoints
- [ ] `GET /warehouse/supplier-returns?supplier_id=&warehouse_id=&status=&date_from=&date_to=` — ro'yxat
- [ ] `POST /warehouse/supplier-returns` — draft yaratish (items bilan)
- [ ] `GET /warehouse/supplier-returns/{id}` — detallar
- [ ] `PATCH /warehouse/supplier-returns/{id}` — draft holida tahrirlash
- [ ] `POST /warehouse/supplier-returns/{id}/submit` — `draft → awaiting_shipment`
- [ ] `POST /warehouse/supplier-returns/{id}/ship` — `awaiting_shipment → shipped`, har item uchun `_stock_apply(delta=-qty, allow_negative=False, operation_type="purchase_return")` + journal yozuvi
- [ ] `POST /warehouse/supplier-returns/{id}/complete` — `shipped → completed`, refund_method'ga qarab moliya integratsiya (pastga qarang)
- [ ] `POST /warehouse/supplier-returns/{id}/cancel` — agar `shipped` bo'lsa stock qaytariladi (`_stock_apply(delta=+qty)`)
- [ ] Yetarli qoldiq yo'qligida `/ship` → 422

### Moliya integratsiya (`/complete`)
- [ ] `refund_method = cash_refund` → `cash_movements`da yozuv (pul qaytishi, salbiy chiqim)
- [ ] `refund_method = supplier_balance` → `supplier_balances` yoki `supplier_accounts` jadvalida credit += refund_amount (mavjud jadval bo'lmasa schema_patches'ga qo'shing)
- [ ] `refund_method = replacement` → faqat yozuv, moliya harakati yo'q

### Frontend
- [ ] `/supply/supplier-returns` sahifasi: ro'yxat (supplier, sana, summa, status), filter paneli
- [ ] "Yangi qaytarish" modal: supplier tanlash, original purchase (ixtiyoriy), mahsulotlar qo'shish
- [ ] Status badge ranglari: draft=gray, awaiting=amber, shipped=blue, completed=green, cancelled=rose
- [ ] Har status uchun to'g'ri harakat tugmasi (Submit, Ship, Complete, Cancel)
- [ ] Mobile table pattern: desktop `<table>` + mobile `<ul>` cards
- [ ] `menu.config.ts`ga `permission: "warehouse.manage_supplier_returns"` bilan qo'shilgan

### Tests
- [ ] `test_supplier_returns.py`: to'liq workflow draft → ship → complete
- [ ] `test_supplier_returns.py`: ship'da yetarli qoldiq yo'q → 422
- [ ] `test_supplier_returns.py`: cancel after ship → stock qaytadi

---

## Technical Notes

- `_stock_apply` T-200 dan keyin `stock_movements` ham yozadi — bu ticket T-200 merge bo'lgandan keyin to'liq bo'ladi.
- **Antipattern**: `supplier_returns`ni `write_offs` ga yozmaslik — semantika boshqa (qaytarish = ta'minotchi haqi, write_off = yo'qotish).
- `doc_number` avtomatik `_next_doc_number("SR", org_id)` pattern bilan yaratiladi.
- `organization_id` barcha query'larda filter sifatida keladi — multi-tenant qoida buzilmasin.

---

## Definition of Done

- [ ] Mechanical: `pytest apps/api/tests/test_supplier_returns.py -v` — 0 fail
- [ ] Mechanical: barcha avvalgi testlar regression yo'q
- [ ] Agentic: qa-reviewer BLOCKER yo'q
- [ ] Behavioral: manual smoke — draft yaratish, ship qilish, stock kamaydi, complete, cash_movement paydo bo'ldi
- [ ] Human-gate: merge
