# ERP Gap Analysis — TZ Inventory Requirements

> Yaratilgan: 2026-09-05
> ERP holat asosi: Sprint 1-4 tugagan, ~90 jadval, schema_patches.py to'liq o'qilgan

---

## TZ-01 Formirovanie skladov

**ERP mavjud holat:**
- `warehouses` jadvali mavjud (init.sql): id, organization_id, name, address, responsible_id, is_active
- `warehouse_types` mavjud (schema_patches.py Faza 12): type_id FK products'ga
- `warehouse_rows`, `warehouse_racks`, `warehouse_cells` mavjud (Sprint W1/W2): 5-daraja ombor ierarxiyasi
- `stock_balances (warehouse_id, product_id, quantity, avg_cost)` mavjud

**Status: PARTIAL**

**Farqlar (Gap):**
- `warehouses.location_id` (filial/lokatsiya FK) yo'q — faqat `address TEXT`
- `warehouses.comment` ustuni yo'q
- Deaktivatsiya oldidan "ochiq operatsiyalar" tekshiruvi yo'q (faqat `is_active` flag)
- `warehouses` ning mavjud qoldigi nolga tushganligini tekshirib deaktivatsiya qilish logikasi yo'q
- `warehouses.organization_id` mavjud — multi-tenant to'g'ri

**Ehtiyoj qilinadigan fayllar:**
- Backend: `apps/api/app/modules/warehouse/router.py` — deaktivatsiya endpoint'iga guard qo'shish
- DB: `ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS comment TEXT`
- Test: `apps/api/tests/test_warehouse_deactivation.py`

**Priority: P1**
**Estimated effort: S**

---

## TZ-02 Tochki prodazhi

**ERP mavjud holat:**
- `cashboxes` mavjud: id, organization_id, name, currency_id, responsible_id, is_active, balance
- `open_tickets` mavjud: cashbox_id, warehouse_id — sotuv nuqtasi-sklad bog'lanishi BOR
- `sales.warehouse_id` mavjud — sotuv sklad bilan bog'liq
- `pos_pages`, `pos_page_items` mavjud (mobile POS UI uchun)
- `_stock_apply(..., allow_negative=False)` service mavjud

**Status: PARTIAL**

**Farqlar (Gap):**
1. **`cashboxes.warehouse_id` yo'q** — cashbox va sklad to'g'ridan-to'g'ri bog'liq emas. `open_tickets.warehouse_id` bor lekin bu ticket darajasida, cashbox darajasida emas.
2. **Sotuv `_stock_apply` chaqiradimi?** — `sale/router.py`da `_stock_apply` chaqiruvi topilmadi (grep nol natija). Sotuv paytida qoldiq kamaytirish logikasi mavjudligi shubhali.
3. `sale_returns.warehouse_id` mavjud — qaytarish skladga bog'liq.

**Ehtiyoj qilinadigan fayllar:**
- Backend: `apps/api/app/modules/sale/router.py` — sotuv tasdiqlashda `_stock_apply` chaqiruvini tekshirish/qo'shish
- DB: `ALTER TABLE cashboxes ADD COLUMN IF NOT EXISTS warehouse_id INT REFERENCES warehouses(id)`
- Frontend: `apps/web/app/(dashboard)/settings/devices/page.tsx` — cashbox sozlamalarida sklad tanlash
- Test: `apps/api/tests/test_sale_stock_deduction.py`

**Priority: P0 (blocker)**
**Estimated effort: M**

---

## TZ-03 Kartochka tovara

**ERP mavjud holat:**
- `products` jadvali to'liq: name, sku, barcode, category_id, unit_id, purchase_price, sale_price, currency_id, is_active, is_service, is_produced
- Kengaytirilgan ustunlar (schema_patches): is_material, is_semi_product, is_marked, is_variant, parent_id, has_expiration, image_url, box_qty, dim_*, description, kind, mxik
- `product_categories` mavjud (parent_id bilan ierarxik)
- `price_history` mavjud — narx o'zgarishlari tarixi
- Stock balances `stock_balances` orqali — sklad bo'yicha qoldiq mavjud
- MXIK kodi qo'shilgan (Sprint 4)

**Status: PARTIAL**

**Farqlar (Gap):**
- `products.min_qty` (minimal qoldiq produkta darajasida) yo'q — faqat `recommended_stock` jadvalida per-warehouse minimal qoldiq bor
- Holat `is_active` boolean, lekin TZ uchta holat talab qiladi: faol / to'ldirish kerak (qty=0) / arxiv. Arxiv flag alohida yo'q (`is_active=false` arxivga tengmi — aniqlik yo'q)
- Asosiy ta'minotchi (`default_supplier_id`) products jadvalida yo'q
- Sotuv va zakupkadan to'g'ridan-to'g'ri harakat tarixi ko'rish UI mavjud emas (backend bo'lishi mumkin lekin TZ-07 gacha)

**Ehtiyoj qilinadigan fayllar:**
- DB: `ALTER TABLE products ADD COLUMN IF NOT EXISTS default_supplier_id UUID REFERENCES suppliers(id)`, `ALTER TABLE products ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE`
- Backend: `apps/api/app/modules/warehouse/router.py` — holat maydoni logikasini kengaytirish
- Frontend: `apps/web/app/(dashboard)/warehouse/products/page.tsx`

**Priority: P1**
**Estimated effort: S**

---

## TZ-04 Neskolko shtrixkodov v kartochke tovara

**ERP mavjud holat:**
- `product_barcodes` jadvali MAVJUD (schema_patches.py, Faza 13):
  ```sql
  id BIGSERIAL PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  barcode VARCHAR(100) NOT NULL,
  type VARCHAR(20) DEFAULT 'EAN13',
  UNIQUE (product_id, barcode)
  ```
- `idx_product_barcodes_barcode` indeksi mavjud
- `products.barcode` alohida VARCHAR(50) ham mavjud (asosiy barcode)

**Status: PARTIAL**

**Farqlar (Gap):**
1. **`is_primary` flag yo'q** — qaysi biri asosiy ekanligi aniqlanmagan
2. **`is_active` flag yo'q** — deaktivatsiya/qayta faollashtirish mexanizmi yo'q
3. **Tizim darajasida barcode yagonaligi tekshiruvligi yo'q** — `UNIQUE (product_id, barcode)` faqat bir product ichida unique, tizim darajasida emas
4. **Skanerlash vaqtida barcode lookup** faqat `products.barcode` bo'yicha ishlashi mumkin — `product_barcodes` dan qidiruv endpoint chiqarilganmi?
5. `type`, `is_primary`, `is_active`, `added_at`, `added_by`, `deactivated_at` maydonlari yetishmaydi (TZ audit talablari)

**Ehtiyoj qilinadigan fayllar:**
- DB (schema_patches.py):
  ```sql
  ALTER TABLE product_barcodes ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT FALSE;
  ALTER TABLE product_barcodes ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
  ALTER TABLE product_barcodes ADD COLUMN IF NOT EXISTS added_by UUID REFERENCES users(id);
  ALTER TABLE product_barcodes ADD COLUMN IF NOT EXISTS added_at TIMESTAMPTZ DEFAULT NOW();
  CREATE UNIQUE INDEX IF NOT EXISTS uq_product_barcodes_active_barcode
    ON product_barcodes(barcode) WHERE is_active = TRUE;
  ```
- Backend: `apps/api/app/modules/warehouse/router.py` — barcode CRUD endpointlari
- Frontend: `apps/web/app/(dashboard)/warehouse/products/page.tsx` — shtrix-kodlar bloki
- Test: `apps/api/tests/test_product_barcodes.py`

**Priority: P0 (blocker)**
**Estimated effort: M**

---

## TZ-05 Postavshchiki

**ERP mavjud holat:**
- `suppliers` jadvali mavjud: id, organization_id, code, name, phone, email, address, tin, notes, is_active, created_at
- `supplies` jadvalida `supplier_id` FK mavjud
- Ta'minotchi kartasidan zakupkalar ro'yxati — backend endpoint mavjud bo'lishi mumkin

**Status: PARTIAL**

**Farqlar (Gap):**
- `suppliers.contact_person` (kontakt shaxs) yo'q — faqat name va phone
- Moliya integratsiya: ta'minotchi balans/o'zaro hisob-kitob uchun `entity_set_balance` mavjud (subject_type='supplier')
- Ta'minotchiga qaytarishlar ro'yxati kartadan ko'rish — TZ-10 (supplier_returns) yo'qligi sababli cheklangan

**Ehtiyoj qilinadigan fayllar:**
- DB: `ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS contact_person VARCHAR(150)`
- Backend: supplier detail endpoint'ni qaytarishlar bilan boyitish (TZ-10 tugagandan keyin)

**Priority: P2**
**Estimated effort: S**

---

## TZ-06 Zakupki i priem tovarov

**ERP mavjud holat:**
- `supplies` / `supply_items` mavjud
- `supply_status ENUM ('draft','approved','received','cancelled')` — 4 holat
- `_stock_apply` warehouse service'da mavjud
- `cash_movements.supply_id` FK mavjud — DDS bog'lanish bor

**Status: PARTIAL**

**Farqlar (Gap):**
- TZ holatlari: `draft, awaiting_receipt, partially_received, posted, cancelled` — ERP'da `approved` va `received` bor, lekin `awaiting_receipt` va `partially_received` yo'q
- Qisman qabul (`partially_received`) logikasi ko'rinmaydi
- `supply_items`da `received_qty` (haqiqatda qabul qilingan miqdor) ustuni yo'q — faqat `quantity`

**Ehtiyoj qilinadigan fayllar:**
- DB: `ALTER TABLE supply_items ADD COLUMN IF NOT EXISTS received_qty NUMERIC(20,3)`, supply_status enum kengaytirish
- Backend: qisman qabul endpoint
- Test: `apps/api/tests/test_supply_partial_receive.py`

**Priority: P1**
**Estimated effort: M**

---

## TZ-07 Zhurnal dvizheniya tovarov

**ERP mavjud holat:**
- `stock_balances` jadvali: faqat **joriy qoldiq** — bu balans jadvali, JURNAL EMAS
- `audit_log` umumiy: action, entity, entity_id, diff — bur tovar harakati jurnali uchun emas
- Birorta `stock_movements` jadval **YO'Q**

**Status: MISSING**

**Farqlar (Gap):**
- Butun TZ-07 talab qiladigan immutable journal jadval mavjud emas
- `stock_balances` UPDATE bilan o'zgaradi — tarix saqlanmaydi
- `before_qty`, `after_qty`, `change_qty`, `operation_type`, `document_id`, `document_type`, `user_id`, `cost` maydonlari hech qaerda yo'q
- Barcha operatsiyalar (sotuv, zakupka, ko'chirish, inventarizatsiya...) birlashtirilgan ko'rinish yo'q
- Manba hujjatga havola (correlation) yo'q

**Ehtiyoj qilinadigan fayllar:**
- DB (schema_patches.py): `stock_movements` yangi jadval
- Backend: `apps/api/app/modules/warehouse/service.py` — `_stock_apply` funksiyasiga journal yozish qo'shish
- Backend: `apps/api/app/modules/warehouse/router.py` — `/movements` list endpoint
- Frontend: `apps/web/app/(dashboard)/warehouse/movements/page.tsx`
- Test: `apps/api/tests/test_stock_movements.py`

**Priority: P0 (CRITICAL blocker)**
**Estimated effort: L**

---

## TZ-08 Peremeshchenie mezhdu skladami

**ERP mavjud holat:**
- `internal_transfers` / `internal_transfer_items` mavjud (Sprint W1): draft, sent, received, cancelled
- `_stock_apply(..., allow_negative=False)` — jo'natishda, qaytarishda, qabul qilishda chaqiriladi
- `sent_at`, `received_at`, `sent_by`, `received_by` mavjud

**Status: PARTIAL**

**Farqlar (Gap):**
- `partially_received` holati yo'q — TZ talab qiladi
- `transfer_items` (legacy) va `internal_transfer_items` (yangi) — ikki parallel jadval mavjud. Legacy tozalanmagan
- Qisman qabul logikasi ko'rinmaydi

**Ehtiyoj qilinadigan fayllar:**
- DB: internal_transfers status kengaytirish + qisman qabul ustunlari
- Backend: qisman qabul endpoint

**Priority: P1**
**Estimated effort: S**

---

## TZ-09 Spisanie i oprihodovanie

**ERP mavjud holat:**
- `write_offs` / `write_off_items` / `write_off_reasons` mavjud (init.sql + schema_patches)
- `_stock_apply(..., allow_negative=True)` — write-off paytida (inventarizatsiya natijasi uchun)
- Write-off UI mavjud: `apps/web/app/(dashboard)/warehouse/write-off/`

**Status: PARTIAL**

**Farqlar (Gap):**
- Oprihodovaniye (kiruvchi tuzatish) alohida hujjat turi yo'q — write_offs bilan birlashtirilganmi yoki yo'qmi aniq emas
- `write_offs.operation_type` ('write_off' | 'posting') ustuni yo'q — ikkala operatsiya ajratilmagan
- TZ sabab ro'yxati: `write_off_reasons` mavjud lekin maxsus sabablar (ichki foydalanish, marketing va h.k.) seed data yo'q

**Ehtiyoj qilinadigan fayllar:**
- DB: `ALTER TABLE write_offs ADD COLUMN IF NOT EXISTS operation_type VARCHAR(20) DEFAULT 'write_off'`
- Backend: oprihodovaniye uchun alohida yoki `operation_type` parametrli endpoint
- Frontend: oprihodovaniye UI qo'shish

**Priority: P1**
**Estimated effort: M**

---

## TZ-10 Vozvrat postavshchiku

**ERP mavjud holat:**
- `sale_returns` / `sale_return_items` mavjud (mijoz qaytarishi uchun)
- Ta'minotchiga qaytarish uchun alohida jadval **YO'Q**

**Status: MISSING**

**Farqlar (Gap):**
- `supplier_returns` jadval yo'q
- `supplier_return_items` jadval yo'q
- Kompensatsiya usuli (pul qaytarish / tovar almashtirish / o'zaro hisob-kitob) yo'q
- Holatlari (draft/awaiting_shipment/shipped/completed/cancelled) yo'q
- Ta'minotchiga qaytarish DDS'ga ta'sir qilish logikasi yo'q

**Ehtiyoj qilinadigan fayllar:**
- DB: `supplier_returns`, `supplier_return_items` yangi jadvallar
- Backend: `apps/api/app/modules/warehouse/router.py` yoki yangi `supplier_return/router.py`
- Frontend: `apps/web/app/(dashboard)/supply/supplier-returns/page.tsx`
- Test: `apps/api/tests/test_supplier_returns.py`

**Priority: P0 (blocker)**
**Estimated effort: L**

---

## TZ-11 Kontrol ostatkov i potrebnost v zakupke

**ERP mavjud holat:**
- `recommended_stock (warehouse_id, product_id, min_qty, max_qty)` mavjud (schema_patches)
- `purchase_orders` mavjud (schema_patches): draft PO yaratish uchun
- Frontend: `apps/web/app/(dashboard)/warehouse/recommended-stock/` mavjud

**Status: PARTIAL**

**Farqlar (Gap):**
- Avtomatik bildirishnoma mexanizmi yo'q — faqat ko'rish mumkin
- "Buyurtma kerak" ro'yxatidan to'g'ridan-to'g'ri zakupka draft yaratish (bir click) UI/backend yo'q
- `recommended_stock.last_purchase_price` (oxirgi xarid narxi) yo'q
- Rezerv miqdor (`reserved_qty`) hisobi `stock_balances`da yo'q

**Ehtiyoj qilinadigan fayllar:**
- Backend: `/warehouse/reorder-list` endpoint (min qoldiqdan past tovarlar)
- Backend: `/warehouse/reorder-list/create-po` endpoint — bulk PO yaratish
- Frontend: reorder list sahifasi

**Priority: P1**
**Estimated effort: M**

---

## TZ-12 Inventarizatsiya

**ERP mavjud holat:**
- `inventories` jadvali mavjud (init.sql):
  ```sql
  CREATE TYPE inventory_status AS ENUM ('draft','in_progress','completed','cancelled');
  ```
- `inventory_items (inventory_id, product_id, expected_qty, actual_qty, diff_qty GENERATED)` mavjud
- `inventory_items.diff_qty` avtomatik hisoblanadi

**Status: PARTIAL**

**Farqlar (Gap):**
1. **Holatlari TZ talab qilganidan kam**: `paused` va `pending_confirmation` holatlar **YO'Q** (enum faqat 4 ta)
2. **Parallel ish (multi-user)** uchun `scanned_by` / `scan_events` jadval yo'q — kim qaysi satrni hisoblaganini qayd etish yo'q
3. **Ko'r rejim (blind count)** flag yo'q — `inventories.is_blind BOOLEAN` yo'q
4. **Sklad bloklash** mexanizmi yo'q
5. Inventarizatsiya natijasida avtomatik spisaniye/oprihodovaniye yaratilishi (router.py da `allow_negative=True` bilan `_stock_apply` bor) — MAVJUD lekin hujjat bog'lanishi yo'q

**Ehtiyoj qilinadigan fayllar:**
- DB:
  ```sql
  ALTER TYPE inventory_status ADD VALUE IF NOT EXISTS 'paused';
  ALTER TYPE inventory_status ADD VALUE IF NOT EXISTS 'pending_confirmation';
  ALTER TABLE inventories ADD COLUMN IF NOT EXISTS is_blind BOOLEAN DEFAULT FALSE;
  ALTER TABLE inventories ADD COLUMN IF NOT EXISTS lock_mode VARCHAR(20) DEFAULT 'none';
  ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS scanned_by UUID REFERENCES users(id);
  ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMPTZ;
  CREATE TABLE IF NOT EXISTS inventory_scan_events (...);
  ```
- Backend: pause/resume/confirm endpointlari
- Frontend: inventarizatsiya UI kengaytirish

**Priority: P0 (blocker)**
**Estimated effort: L**

---

## TZ-13 Novy tovar pri inventarizatsii

**ERP mavjud holat:**
- Tovar yaratish endpoint mavjud (`POST /warehouse/products`)
- Inventarizatsiyada tovar qo'shish endpoint mavjud

**Status: PARTIAL**

**Farqlar (Gap):**
- Inventarizatsiya ichidan noma'lum barcode aniqlash va inline tovar yaratish UI/endpoint yo'q
- `products.status = 'needs_filling'` holati yo'q — faqat `is_active` flag
- Inventarizatsiya tugagandan keyin yangi tovarlar uchun avtomatik oprihodovaniye yaratish yo'q (TZ-09 bilan bog'liq)

**Ehtiyoj qilinadigan fayllar:**
- Backend: `POST /warehouse/inventories/{id}/scan-unknown-barcode` endpoint
- Frontend: barcode skanerlash paytida "noma'lum tovar" modal

**Priority: P1**
**Estimated effort: M**

---

## TZ-14 Otchety

**ERP mavjud holat:**
- `statistics` moduli mavjud
- Eksport `tools/exports-center` mavjud
- Ba'zi hisobotlar mavjud: savdo, zakupka

**Status: PARTIAL**

**Farqlar (Gap):**
- TZ-07 `stock_movements` jadvali yo'qligi sababli harakatlar hisoboti YARATIB BO'LMAYDI
- Qoldiqlar hisoboti: `stock_balances` dan chiqarilishi mumkin — mavjud
- Inventarizatsiya hisoboti: inventarizatsiya tugagandan keyin
- Ta'minotchilar hisoboti: `supplier_returns` yo'qligi sababli to'liq emas
- Excel eksport barcha hisobotlar uchun yo'q

**Ehtiyoj qilinadigan fayllar:**
- Backend: har hisobot uchun `/statistics/warehouse-*` endpointlar
- TZ-07 birinchi amalga oshirilishi kerak

**Priority: P1**
**Estimated effort: L**

---

## TZ-15 Otchet po sebestoimosti i valovoy pribyli

**ERP mavjud holat:**
- `stock_balances.avg_cost` — o'rtacha tannarx mavjud
- `sale_items.price` va `supply_items.price` mavjud
- COGS hisobi uchun logika yo'q

**Status: PARTIAL**

**Farqlar (Gap):**
- `sale_items.cost` (sotilgan tovar tannarxi momentida) ustuni yo'q — sotuv paytida tannarx qayd etilmaydi
- COGS hisobot endpoint yo'q
- Yalpi foyda = tushum - COGS hisobi yo'q
- O'rtacha og'irlik usuli sozlamasi yo'q

**Ehtiyoj qilinadigan fayllar:**
- DB: `ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS cost NUMERIC(20,2) DEFAULT 0`
- Backend: sotuv tasdiqlashda `sale_items.cost` ni `stock_balances.avg_cost` dan to'ldirish
- Backend: `/statistics/cogs-report` endpoint

**Priority: P1**
**Estimated effort: M**

---

## TZ-16 Finansovaya integratsiya

**ERP mavjud holat:**
- `cash_movements` jadvali mavjud: sale_id, supply_id FK lar bor
- Finance moduli mavjud (`apps/api/app/modules/finance/router.py`)

**Status: PARTIAL**

**Farqlar (Gap):**
- `cash_movements.supplier_return_id` yo'q (TZ-10 hali yo'q)
- `cash_movements.write_off_id` yo'q — spisaniye DDS'ga ta'siri yo'q
- Sklad va moliya holati alohida bo'lishi: tovar qabul qilindi lekin to'lanmagan — `supplies.payment_status` yo'q

**Ehtiyoj qilinadigan fayllar:**
- DB: `ALTER TABLE cash_movements ADD COLUMN IF NOT EXISTS supplier_return_id UUID REFERENCES supplier_returns(id)` (TZ-10 keyin)
- DB: `ALTER TABLE supplies ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'unpaid'`

**Priority: P1**
**Estimated effort: S**

---

## TZ-17 Roli i prava dostupa

**ERP mavjud holat:**
- RBAC to'liq mavjud: roles, permissions, role_permissions
- `PermissionMiddleware` avtomatik `module.action` derivatsiyasi
- 6 tizim rol: superadmin, admin, manager, accountant, cashier, viewer
- `ALL_PERMISSIONS` va `ROLE_GRANTS` katalog mavjud (`permissions.py`)

**Status: PARTIAL**

**Farqlar (Gap):**
- Filial/sklad darajasida huquq chegaralash yo'q — faqat org darajasida
- Yangi warehouse operatsiyalar (TZ-10 supplier_returns, TZ-07 movements) uchun permissions.py yangilanishi kerak

**Ehtiyoj qilinadigan fayllar:**
- Backend: `apps/api/app/modules/rbac/permissions.py` — yangi permission kodlar qo'shish
- Backend: `apps/api/app/modules/rbac/seed.py` — yangi grantslar

**Priority: P1**
**Estimated effort: S**

---

## TZ-18 Zhurnal aktivnosti

**ERP mavjud holat:**
- `audit_log` jadvali mavjud (init.sql): organization_id, user_id, action, entity, entity_id, diff, ip, user_agent
- `AuditMiddleware` mavjud — har POST/PUT/PATCH/DELETE uchun
- `SENSITIVE_KEYS` ro'yxati mavjud (parol va h.k. redaction)

**Status: PARTIAL**

**Farqlar (Gap):**
- Shtrix-kod o'zgarishlari, inventarizatsiyadagi haqiqiy miqdor o'zgarishlari, narx o'zgarishlari alohida loglanmaydi
- `audit_log.old_value` va `new_value` alohida ustun yo'q — faqat `diff JSONB`
- Hujjat kartasidan alohida audit log filter yo'q (faqat umumiy jurnal)

**Ehtiyoj qilinadigan fayllar:**
- Backend: tovar narxi o'zgarish, barcode o'zgarish eventlari uchun explicit audit yozuv
- Frontend: entity-specific audit log UI komponent

**Priority: P1**
**Estimated effort: S**

---

## TZ-19 Obshchie NFR

**ERP mavjud holat:**
- `_stock_apply` atom transaktsiya ichida ishlaydi (caller commits)
- `UNIQUE` constraintlar dublikatni oldini oladi
- Slowapi rate limiting mavjud
- GIN indekslar qidiruv uchun (pg_trgm)

**Status: PARTIAL**

**Farqlar (Gap):**
- **Idempotency-Key** header mexanizmi yo'q — POS offline queue uchun kerak (TZ-19 + POS kontrakt)
- Parallel inventarizatsiya scan uchun optimistic locking yo'q — `inventory_items` bir vaqtda bir nechta foydalanuvchi yozayotganda race condition ehtimoli bor
- Sana/vaqt zona: `TIMESTAMPTZ` ishlatilgan — OK
- Eksport faqat o'qish: eksport endpointlar GET — OK

**Ehtiyoj qilinadigan fayllar:**
- Backend: `Idempotency-Key` header middleware yoki endpoint darajasida
- Backend: `inventory_items` uchun optimistic lock (version/updated_at)

**Priority: P1**
**Estimated effort: M**

---

## Xulosa jadvali

| ID | Status | Priority | Effort | Sprint |
|---|---|---|---|---|
| TZ-01 | PARTIAL | P1 | S | Sprint 6 |
| TZ-02 | PARTIAL | P0 | M | Sprint 5 |
| TZ-03 | PARTIAL | P1 | S | Sprint 5 |
| TZ-04 | PARTIAL | P0 | M | Sprint 5 |
| TZ-05 | PARTIAL | P2 | S | Sprint 7 |
| TZ-06 | PARTIAL | P1 | M | Sprint 6 |
| TZ-07 | MISSING | P0 | L | Sprint 5 |
| TZ-08 | PARTIAL | P1 | S | Sprint 6 |
| TZ-09 | PARTIAL | P1 | M | Sprint 6 |
| TZ-10 | MISSING | P0 | L | Sprint 5 |
| TZ-11 | PARTIAL | P1 | M | Sprint 6 |
| TZ-12 | PARTIAL | P0 | L | Sprint 5 |
| TZ-13 | PARTIAL | P1 | M | Sprint 6 |
| TZ-14 | PARTIAL | P1 | L | Sprint 6-7 |
| TZ-15 | PARTIAL | P1 | M | Sprint 6 |
| TZ-16 | PARTIAL | P1 | S | Sprint 6 |
| TZ-17 | PARTIAL | P1 | S | Sprint 5 |
| TZ-18 | PARTIAL | P1 | S | Sprint 6 |
| TZ-19 | PARTIAL | P1 | M | Sprint 6 |
