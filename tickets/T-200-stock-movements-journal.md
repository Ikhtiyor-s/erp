# T-200 — stock_movements Immutable Journal

**Owner Role**: backend-dev
**Depends On**: none
**Blocks**: T-201, T-202, T-204, T-207, T-210, T-211
**Estimated Size**: L (3-5 kun)
**Priority**: P0
**TZ Reference**: TZ-07

---

## Rationale

Hozirda `stock_balances` faqat joriy qoldiqni saqlaydi — tarix yo'q. Sotuv, xarid, ko'chirish qaysi operatsiyadan qancha qoldiq o'zgargani tekshirib bo'lmaydi. Bu moliyaviy tekshiruv (audit), COGS hisob-kitobi, va har qanday stock reconciliation uchun blocker. `stock_movements` append-only jurnali har qoldiq o'zgarishini manba hujjatga bog'liq holda yozadi — bu Sprint 5 dagi barcha boshqa inventory ticketlar uchun poydevor.

Biznes qiymati: kassir yoki menejer "ushbu mahsulot qachon, kim tomonidan qancha kamaytirilib qoldi?" degan savolga tezkor javob oladi. Hisobchi COGS hisobotini o'z ichiga olgan oylik moliyaviy hisobotni tuzadi.

---

## Files Likely Touched

- **DB**: `apps/api/app/db/schema_patches.py` — yangi jadval va indekslar
- **Backend service**: `apps/api/app/modules/warehouse/service.py` — `_stock_apply` ichiga `_write_movement` qo'shish
- **Backend router**: `apps/api/app/modules/warehouse/router.py` — yangi `GET /warehouse/stock-movements` endpoint
- **RBAC**: `apps/api/app/modules/rbac/permissions.py` — `warehouse.view_movements` permission
- **RBAC seed**: `apps/api/app/modules/rbac/seed.py` — manager, accountant, admin'ga grant
- **Tests**: `apps/api/tests/test_stock_movements.py` — yangi test fayl

---

## Acceptance Criteria

- [ ] `stock_movements` jadvali `schema_patches.py`da `CREATE TABLE IF NOT EXISTS` sifatida mavjud
- [ ] Ustunlar: `id UUID PK`, `organization_id UUID NOT NULL`, `warehouse_id INT NOT NULL`, `product_id UUID NOT NULL`, `quantity_before NUMERIC(20,3)`, `quantity_change NUMERIC(20,3) NOT NULL`, `quantity_after NUMERIC(20,3)`, `unit_cost NUMERIC(20,4)`, `operation_type VARCHAR(30) NOT NULL`, `user_id UUID`, `source_document_type VARCHAR(50)`, `source_document_id UUID`, `external_id VARCHAR(255)`, `correlation_id UUID`, `created_at TIMESTAMPTZ DEFAULT NOW()`
- [ ] `operation_type` qabul qiluvchi qiymatlar: `purchase`, `sale`, `sale_return`, `purchase_return`, `write_off`, `oprihodovanie`, `transfer_out`, `transfer_in`, `inventory_adjust` — application-level validation
- [ ] Indeks: `(organization_id, warehouse_id, product_id, created_at DESC)` mavjud
- [ ] Indeks: `(organization_id, correlation_id)` mavjud
- [ ] Unique indeks: `(organization_id, external_id) WHERE external_id IS NOT NULL` — idempotency uchun
- [ ] `_stock_apply` ichida `stock_balances` UPDATE va `stock_movements` INSERT bitta DB transaksiyasida bajariladi
- [ ] `_stock_apply` chaqiruvi `source_document_type`, `source_document_id`, `operation_type`, `user_id`, `correlation_id` parametrlarini qabul qiladi (barcha mavjud caller'lar uchun default=None bilan backward compatible)
- [ ] **Append-only guard**: `stock_movements` jadvalida `BEFORE UPDATE OR DELETE` trigger qo'yiladi — har doim EXCEPTION tashlaydi ("stock_movements is immutable")
- [ ] `GET /warehouse/stock-movements` endpoint ishlaydi: `?warehouse_id=&product_id=&date_from=&date_to=&operation_type=&limit=&offset=`
- [ ] Endpoint `organization_id` filter bilan qaytaradi — boshqa org ma'lumoti ko'rinmaydi
- [ ] `warehouse.view_movements` permission: manager, accountant, admin rollari uchun grant qilingan
- [ ] `test_stock_movements.py`: `_stock_apply` chaqiruvidan keyin `stock_movements`da 1 yozuv paydo bo'ladi
- [ ] `test_stock_movements.py`: `stock_movements`da to'g'ridan-to'g'ri UPDATE urinishi DB exception tashlaydi
- [ ] Mavjud testlar (barcha `_stock_apply` chaqiruvlari) hali ham o'tadi — backward compatible

---

## Technical Notes

- **Antipattern**: `stock_movements` jadvalini hech qachon UPDATE yoki DELETE qilmang. Agar xato kiritilsa — teskari yozuv (`quantity_change` salbiy) `inventory_adjust` operatsiya turi bilan qo'shiladi.
- `_stock_apply` signaturasi o'zgarganda sale/router.py, warehouse/router.py dagi barcha chaqiruvlarni ko'rib chiqing — `**kwargs` yoki default parametrlar orqali backward compatibility saqlang.
- `WHERE field >= :df AND field < (:dt::date + INTERVAL '1 day')` pattern — `created_at::date` cast qilmang (indeksni sindiradi).
- `correlation_id` multi-leg operatsiyalar uchun (masalan transfer_out + transfer_in bir UUID bilan bog'lanadi).
- `external_id` T-208 idempotency key bilan bog'lanadi keyinchalik.
- Trigger PostgreSQL `plpgsql` da yoziladi, `schema_patches.py`ga `CREATE OR REPLACE FUNCTION` + `CREATE TRIGGER IF NOT EXISTS` sifatida qo'shiladi.

---

## Definition of Done

- [ ] Mechanical: `docker exec erp-api pytest apps/api/tests/test_stock_movements.py -v` — 0 fail
- [ ] Mechanical: barcha avvalgi testlar `pytest apps/api/tests/ -v` — 0 regression
- [ ] Agentic: qa-reviewer `BLOCKER: none` tasdiqlaydi
- [ ] Behavioral: manual smoke — purchase yaratib tasdiqlagach `GET /warehouse/stock-movements` da 1 yozuv ko'rinadi
- [ ] Human-gate: jamoa rahbari PR ni merge qiladi
