# T-207 — sale_items.unit_cost + COGS + Gross Profit Hisoboti

**Owner Role**: both (backend-dev + frontend-dev)
**Depends On**: T-200 (stock_movements — avg_cost ma'lumoti uchun; parallel ishlanishi mumkin lekin T-200 merged bo'lganda integratsiya to'liq bo'ladi)
**Blocks**: none
**Estimated Size**: M (1-3 kun)
**Priority**: P0
**TZ Reference**: TZ-07 (harakatlar tarixi), TZ-13 (foyda hisobi)

---

## Rationale

Hozirda sotilgan mahsulotning xarid narxi sotuv vaqtida saqlanmaydi. Bu COGS (Cost of Goods Sold) va gross profit hisob-kitobini imkonsiz qiladi — hisobchi foyda-zarar hisobotini tuza olmaydi. `sale_items.unit_cost` sotuv paytida `stock_balances.avg_cost` (yoki `products.avg_cost`) snapshot'i sifatida yozilishi kerak. Bu ma'lumotga asoslangan COGS report va gross profit ko'rsatgichi tuziladi.

---

## Files Likely Touched

- **DB**: `apps/api/app/db/schema_patches.py` — `sale_items.unit_cost` ustun
- **Backend**: `apps/api/app/modules/sale/router.py` — sotuv tasdiqlashda `unit_cost` snapshot
- **Backend**: `apps/api/app/modules/warehouse/router.py` yoki yangi statistics — COGS endpoint
- **RBAC**: `apps/api/app/modules/rbac/permissions.py` — `warehouse.view_cost_price`, `statistics.view_cogs`
- **Frontend**: `apps/web/app/(dashboard)/statistics/cogs-report/page.tsx` — yangi sahifa
- **Frontend menu**: `apps/web/lib/menu.config.ts`
- **i18n**: `apps/web/i18n/messages/uz.json`, `ru.json`, `en.json`
- **Tests**: `apps/api/tests/test_cogs_report.py`

---

## Acceptance Criteria

### DB Schema
- [ ] `ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(20,4) DEFAULT 0` — nullable, eski yozuvlar uchun 0

### Backend — Sotuv tasdiqlash
- [ ] `POST /sale/sales/{id}/confirm` — har `sale_item` uchun `unit_cost` avtomatik to'ldiriladi:
  1. `SELECT avg_cost FROM stock_balances WHERE warehouse_id = :w AND product_id = :p` — sotuv omboridan snapshot
  2. Topilmasa: `SELECT avg_cost FROM products WHERE id = :p` — fallback
  3. `UPDATE sale_items SET unit_cost = :cost WHERE id = :item_id`
- [ ] `unit_cost` sotuv tasdiqlangandan KEYIN o'zgarmaydi (immutable after confirm)

### Backend — COGS Endpoint
- [ ] `GET /statistics/cogs?date_from=&date_to=&warehouse_id=&category_id=`
  - Response:
    ```json
    {
      "period": {"from": "2026-01-01", "to": "2026-01-31"},
      "revenue": 15000000,
      "cogs": 10000000,
      "gross_profit": 5000000,
      "gross_margin_pct": 33.3,
      "by_category": [
        {"category_id": "...", "category_name": "...", "revenue": ..., "cogs": ..., "gross_profit": ...}
      ]
    }
    ```
  - SQL: `SUM(si.quantity * si.unit_price)` = revenue; `SUM(si.quantity * si.unit_cost)` = COGS
  - `WHERE s.confirmed_at >= :df AND s.confirmed_at < (:dt::date + INTERVAL '1 day')` — to'g'ri date filter
- [ ] `warehouse.view_cost_price` permission: accountant, admin
- [ ] `statistics.view_cogs` permission: accountant, admin, manager

### Frontend — COGS Sahifasi
- [ ] `/statistics/cogs-report` yangi sahifa
- [ ] Filter paneli: sana diapazoni, sklad, kategoriya
- [ ] Summary kartalar: Daromad, Tannarx (COGS), Yalpi foyda, Margin %
- [ ] Jadval: kategoriya bo'yicha breakdown
- [ ] Responsive: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` summary kartalar uchun
- [ ] Brand ranglar: emerald=foyda, rose=zarar (agar margin salbiy)
- [ ] `menu.config.ts`ga `permission: "statistics.view_cogs"` bilan qo'shilgan

### Tests
- [ ] `test_cogs_report.py`: sotuv tasdiqlanganda `sale_items.unit_cost` to'ldiriladi
- [ ] `test_cogs_report.py`: `GET /statistics/cogs` to'g'ri COGS va gross_profit hisoblaydi
- [ ] `test_cogs_report.py`: boshqa org ma'lumoti ko'rinmaydi

---

## Technical Notes

- **Antipattern**: `sale_items.unit_cost` ni sotuv `draft` holatida to'ldirmang — xarid narxi sotuv tasdiqlangunga qadar o'zgarishi mumkin. Faqat `confirm` paytida snapshot oling.
- `avg_cost = 0` bo'lsa (yangi mahsulot, hali xarid qilinmagan) — `unit_cost = 0` yoziladi, COGS = 0 (to'g'ri — mavjud tannarx yo'q).
- `field::date` cast ishlatmang — `WHERE s.confirmed_at >= :df AND s.confirmed_at < (:dt::date + INTERVAL '1 day')` pattern.
- `statistics` module mavjud emasligini tekshiring (`apps/api/app/modules/statistics/router.py`) — mavjud bo'lsa shu faylga qo'shing, yo'q bo'lsa yangi modul yaratmang, `warehouse/router.py`da qo'shing.

---

## Definition of Done

- [ ] Mechanical: `pytest apps/api/tests/test_cogs_report.py -v` — 0 fail
- [ ] Mechanical: `psql -c "\d sale_items"` — `unit_cost` ustun ko'rinadi
- [ ] Agentic: qa-reviewer BLOCKER yo'q
- [ ] Behavioral: test sotuv tasdiqlangach `unit_cost` to'ldirilgan, COGS report to'g'ri hisob ko'rsatadi
- [ ] Human-gate: merge
