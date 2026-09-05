# T-210 — Oprihodovaniye Alohida Operatsiya (stock_ins + frontend)

**Owner Role**: both (backend-dev + frontend-dev)
**Depends On**: T-200 (stock_movements journal — `oprihodovanie` operation_type)
**Blocks**: none
**Estimated Size**: S (< 1 kun)
**Priority**: P0
**TZ Reference**: TZ-08 (kirim operatsiyalari)

---

## Rationale

Hozirda "kirim bilan olib kelish" (oprihodovaniye / posting) funksiyasi yo'q. `write_offs` faqat chiqim operatsiyasini bildiradi. Moddiy boyliklar omborga bevosita (xarid qilmasdan) kiritish kerak bo'lganda — ochilish qoldig'i, xodim olib kelgan tovar, natural qoldiq — bu faqat write_off manfiy sifatida kiritiladi yoki umuman yo'q. Bu semantik xato va moliyaviy hisobda noto'g'ri ko'rinadi. Alohida `stock_ins` jadvali va endpoint bu muammoni hal qiladi.

---

## Files Likely Touched

- **DB**: `apps/api/app/db/schema_patches.py` — `stock_ins`, `stock_in_items` jadvallar
- **Backend**: `apps/api/app/modules/warehouse/router.py` — yangi endpoint guruh
- **RBAC**: `apps/api/app/modules/rbac/permissions.py` — `warehouse.manage_stock_ins`
- **RBAC seed**: `apps/api/app/modules/rbac/seed.py`
- **Frontend**: `apps/web/app/(dashboard)/warehouse/stock-in/page.tsx` — yangi sahifa
- **Frontend menu**: `apps/web/lib/menu.config.ts`
- **i18n**: `apps/web/i18n/messages/uz.json`, `ru.json`, `en.json`
- **Tests**: `apps/api/tests/test_stock_ins.py`

---

## Acceptance Criteria

### DB Schema
- [ ] `stock_ins(id UUID PK DEFAULT gen_random_uuid(), organization_id UUID NOT NULL FK, warehouse_id INT NOT NULL FK warehouses, doc_number VARCHAR(50), reason TEXT, status VARCHAR(20) DEFAULT 'draft', confirmed_at TIMESTAMPTZ, created_by UUID FK users, created_at TIMESTAMPTZ DEFAULT NOW())` — `CREATE TABLE IF NOT EXISTS`
- [ ] `stock_in_items(id BIGSERIAL PK, stock_in_id UUID FK stock_ins ON DELETE CASCADE, product_id UUID FK products, quantity NUMERIC(20,3) NOT NULL, unit_cost NUMERIC(20,4) DEFAULT 0, amount NUMERIC(20,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED)`
- [ ] `status` qiymatlari: `draft`, `confirmed`, `cancelled`
- [ ] Index: `(organization_id, status)`, `(organization_id, warehouse_id)`

### Backend Endpoints
- [ ] `GET /warehouse/stock-ins?warehouse_id=&status=&date_from=&date_to=` — ro'yxat
- [ ] `POST /warehouse/stock-ins` — draft yaratish (`warehouse_id`, `reason`, `items: [{product_id, quantity, unit_cost}]`)
- [ ] `GET /warehouse/stock-ins/{id}` — detallar + items
- [ ] `PATCH /warehouse/stock-ins/{id}` — draft holatida tahrirlash
- [ ] `POST /warehouse/stock-ins/{id}/confirm` — `draft → confirmed`:
  - Har item uchun `_stock_apply(delta=+qty, operation_type="oprihodovanie", allow_negative=False)` (qty musbat)
  - `stock_balances.avg_cost` qayta hisoblash (WAC formula)
  - `stock_movements` INSERT (T-200 integratsiya)
  - `confirmed_at = NOW()`
- [ ] `POST /warehouse/stock-ins/{id}/cancel` — faqat `draft` holatida
- [ ] `warehouse.manage_stock_ins` permission: manager, admin

### Frontend
- [ ] `/warehouse/stock-in/` sahifasi — ro'yxat (sana, sklad, sabab, summa, status)
- [ ] "Yangi kirim" modal: sklad, sabab, mahsulotlar qo'shish (product picker + qty + narx)
- [ ] Status badge: draft=gray, confirmed=green, cancelled=rose
- [ ] "Tasdiqlash" tugmasi `<ConfirmDialog>` bilan
- [ ] Mobile table pattern (desktop table + mobile cards)
- [ ] `menu.config.ts`ga `permission: "warehouse.manage_stock_ins"` bilan qo'shilgan

### Tests
- [ ] `test_stock_ins.py`: yaratish → confirm → stock oshdi
- [ ] `test_stock_ins.py`: confirm → `stock_movements`da `oprihodovanie` yozuvi (T-200 bilan)
- [ ] `test_stock_ins.py`: confirmed holatda PATCH → 422
- [ ] `test_stock_ins.py`: cancel confirmed → 422

---

## Technical Notes

- **Antipattern**: `write_offs`'da `operation_type` ustun qo'shib "inverted" write-off qilmang — semantik jihatdan noto'g'ri, alohida jadval afzal.
- `doc_number` — `_next_doc_number("SI", org_id)` pattern.
- WAC (Weighted Average Cost) hisob: `new_avg = (old_qty * old_avg + incoming_qty * unit_cost) / (old_qty + incoming_qty)`.
- `write_offs` jadvali o'ZGARTIRILMAYDI — faqat yangi jadval yaratiladi.
- `_stock_apply` delta musbat (`+qty`) — kirim operatsiyasi uchun `allow_negative` parametri ahamiyatsiz, lekin signature'ni buzmaslik uchun `allow_negative=True` uzating.

---

## Definition of Done

- [ ] Mechanical: `pytest apps/api/tests/test_stock_ins.py -v` — 0 fail
- [ ] Mechanical: `psql -c "\dt stock_ins"` — jadval mavjud
- [ ] Agentic: qa-reviewer BLOCKER yo'q
- [ ] Behavioral: stock_in yaratib tasdiqlash → warehouse mahsulot qoldig'i oshdi
- [ ] Human-gate: merge
