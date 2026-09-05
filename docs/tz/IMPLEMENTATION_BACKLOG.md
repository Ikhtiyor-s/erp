# Implementation Backlog — Aniq ERP Inventory TZ

> Yaratilgan: 2026-09-05
> Sprint 5 = P0 blockers, Sprint 6 = P1, Sprint 7 = P2

---

## Sprint 5 — P0 Blockers (Prod uchun majburiy)

Taxminiy davomiylik: **10-14 ish kuni**

---

### T-200 — stock_movements immutable journal jadvali va service

| Maydon | Qiymat |
|---|---|
| Owner | backend-dev |
| Depends | - |
| Files | `apps/api/app/db/schema_patches.py`, `apps/api/app/modules/warehouse/service.py` |
| Size | L |
| Priority | P0 |

**Tavsif:**
`stock_movements` jadvalini yaratish va `_stock_apply` funksiyasiga `_write_movement` internal call qo'shish.
Har qoldiq o'zgarishi (purchase_in, sale_out, transfer_in/out, write_off_out, posting_in, inventory_adjust) jurnalga yoziladi.

**Acceptance criteria:**
- [ ] `stock_movements` jadvali init.sql/schema_patches da yaratilgan
- [ ] `_stock_apply` chaqirilganda `stock_movements`ga INSERT ham bajariladi, bitta transaktsiyada
- [ ] `external_id` (idempotency) maydon indekslangan
- [ ] `GET /warehouse/movements` endpoint — org_id, warehouse_id, product_id, davr filtrlari bilan
- [ ] Har harakat uchun `document_type` va `document_id` manba hujjatga havola qiladi
- [ ] Mavjud testlar `_stock_apply` ni chaqirganda o'tmaydi emas (backwards compatible)

---

### T-201 — product_barcodes jadvalini TZ-04 talablariga kengaytirish

| Maydon | Qiymat |
|---|---|
| Owner | backend-dev |
| Depends | - |
| Files | `schema_patches.py`, `warehouse/router.py`, `warehouse/products/page.tsx` |
| Size | M |
| Priority | P0 |

**Tavsif:**
Mavjud `product_barcodes` jadvaliga `is_primary`, `is_active`, `added_by`, `added_at` ustunlar qo'shish.
Tizim darajasida `UNIQUE INDEX WHERE is_active = TRUE` qo'shish.
Barcode CRUD endpointlari va set-primary operatsiyasi.

**Acceptance criteria:**
- [ ] `is_primary` va `is_active` ustunlar qo'shilgan
- [ ] `uq_product_barcodes_active` partial unique index mavjud
- [ ] `POST /warehouse/products/{id}/barcodes` — yangi barcode qo'shish
- [ ] `PATCH /warehouse/products/{id}/barcodes/{bid}/set-primary` — asosiy belgilash
- [ ] `PATCH /warehouse/products/{id}/barcodes/{bid}/deactivate` — deaktivatsiya
- [ ] `GET /warehouse/barcode-lookup?q={code}` — faol shtrix-kod bo'yicha tovar topish
- [ ] Dublikat faol barcode qo'shishda 409 Conflict qaytariladi

---

### T-202 — sale confirm paytida stock deduction tekshirish va tuzatish

| Maydon | Qiymat |
|---|---|
| Owner | backend-dev |
| Depends | T-200 |
| Files | `apps/api/app/modules/sale/router.py`, `warehouse/service.py` |
| Size | M |
| Priority | P0 |

**Tavsif:**
`sale/router.py`da sotuv tasdiqlash endpointi `_stock_apply`ni har `sale_items` qatori uchun
`allow_negative=False` bilan chaqirmasligi aniqlangan. Bu TZ-02 va TZ-01 ning asosiy talabi.

**Acceptance criteria:**
- [ ] `POST /sale/sales/{id}/confirm` har sale_item uchun `_stock_apply(delta=-qty, allow_negative=False)` chaqiradi
- [ ] Yetarli qoldiq yo'q bo'lganda 422 xato qaytariladi, holat o'zgarmaydi
- [ ] Sotuv qaytarishda `sale_return` `_stock_apply(delta=+qty)` chaqiradi
- [ ] BOM mahsulot uchun: har komponent bo'yicha alohida stock deduction
- [ ] `test_sale_stock_deduction.py` — negative stock test qo'shilgan

---

### T-203 — cashboxes.warehouse_id qo'shish (POS-sklad bog'lash)

| Maydon | Qiymat |
|---|---|
| Owner | backend-dev |
| Depends | - |
| Files | `schema_patches.py`, `settings/devices/page.tsx` |
| Size | S |
| Priority | P0 |

**Tavsif:**
`cashboxes` jadvaliga `warehouse_id` ustun qo'shish. `open_tickets` yaratishda
sukut bo'yicha `cashbox.warehouse_id` ishlatish.

**Acceptance criteria:**
- [ ] `ALTER TABLE cashboxes ADD COLUMN IF NOT EXISTS warehouse_id INT REFERENCES warehouses(id)`
- [ ] `GET /finance/cashboxes` response'da `warehouse_id` va `warehouse_name` mavjud
- [ ] `PATCH /finance/cashboxes/{id}` `warehouse_id` qabul qiladi
- [ ] Settings UI'da kassa yaratish/tahrirlashda sklad tanlash imkoni

---

### T-204 — supplier_returns jadvali va endpointlar (TZ-10)

| Maydon | Qiymat |
|---|---|
| Owner | backend-dev |
| Depends | T-200 |
| Files | `schema_patches.py`, `warehouse/router.py`, yangi `supplier-returns/page.tsx` |
| Size | L |
| Priority | P0 |

**Tavsif:**
`supplier_returns` va `supplier_return_items` jadvallarini yaratish.
To'liq CRUD + status workflow (draft → shipped → completed).
Tasdiqlanishda `_stock_apply(delta=-qty)` va `cash_movements` (pul qaytarish uchun).

**Acceptance criteria:**
- [ ] `supplier_returns` va `supplier_return_items` jadvallar mavjud
- [ ] `GET /warehouse/supplier-returns` — ro'yxat (supplier, warehouse, status filtrlari)
- [ ] `POST /warehouse/supplier-returns` — draft yaratish
- [ ] `POST /warehouse/supplier-returns/{id}/submit` — awaiting_shipment
- [ ] `POST /warehouse/supplier-returns/{id}/ship` — stock deduction + movement yozuv
- [ ] `POST /warehouse/supplier-returns/{id}/complete` — refund/offset moliya
- [ ] `POST /warehouse/supplier-returns/{id}/cancel` — stock qaytarish (agar shipped bo'lsa)
- [ ] `test_supplier_returns.py` — to'liq workflow testi

---

### T-205 — inventory holatlari kengaytirish: paused + pending_confirmation (TZ-12)

| Maydon | Qiymat |
|---|---|
| Owner | backend-dev |
| Depends | - |
| Files | `schema_patches.py`, `warehouse/router.py`, `warehouse/revision/page.tsx` |
| Size | L |
| Priority | P0 |

**Tavsif:**
`inventory_status` ENUM'ga `paused` va `pending_confirmation` qo'shish.
`pause/resume/submit-for-confirmation/confirm` endpointlarini yaratish.
`is_blind` flag, `lock_mode`, parallel scan uchun `inventory_scan_events` jadvali.

**Acceptance criteria:**
- [ ] `ALTER TYPE inventory_status ADD VALUE IF NOT EXISTS 'paused'` — idempotent
- [ ] `ALTER TYPE inventory_status ADD VALUE IF NOT EXISTS 'pending_confirmation'`
- [ ] `POST /warehouse/inventories/{id}/pause` — in_progress → paused
- [ ] `POST /warehouse/inventories/{id}/resume` — paused → in_progress
- [ ] `POST /warehouse/inventories/{id}/submit` — in_progress → pending_confirmation
- [ ] `POST /warehouse/inventories/{id}/confirm` — tasdiqlash, hujjat yaratish
- [ ] `inventory_scan_events` jadvali yaratilgan, parallel scan yoziladigan
- [ ] `inventory_items.version` optimistic lock ishlaydi (409 parallel conflict)
- [ ] `test_inventory_rich_states.py`

---

### T-206 — RBAC permissions yangilash (TZ-07, TZ-10, TZ-12 uchun)

| Maydon | Qiymat |
|---|---|
| Owner | backend-dev |
| Depends | T-200, T-204, T-205 |
| Files | `apps/api/app/modules/rbac/permissions.py`, `rbac/seed.py` |
| Size | S |
| Priority | P0 |

**Tavsif:**
Yangi operatsiyalar uchun permission kodlar va role grantslar qo'shish.

**Acceptance criteria:**
- [ ] `warehouse.view_movements` — manager, accountant, admin
- [ ] `warehouse.manage_supplier_returns` — manager, admin
- [ ] `warehouse.manage_inventory_advanced` (pause/confirm) — manager, admin
- [ ] `warehouse.view_cost_price` — accountant, admin (xarid narxi, tannarx)
- [ ] Seed yangilangan, mavjud rollarga ta'sir etmaydi

---

## Sprint 6 — P1 (Keyingi sprint)

Taxminiy davomiylik: **10-14 ish kuni**

---

### T-210 — stock_movements frontend sahifasi (TZ-07)

| Maydon | Qiymat |
|---|---|
| Owner | frontend-dev |
| Depends | T-200 |
| Files | `apps/web/app/(dashboard)/warehouse/movements/page.tsx` |
| Size | M |
| Priority | P1 |

**Acceptance criteria:**
- [ ] Filtrlar: davr, sklad, tovar, kategoriya, operatsiya turi, xodim
- [ ] Har qator: operatsiya turi, tovar, sklad, qoldiq (oldin/o'zgarish/keyin), tannarx, foydalanuvchi, sana
- [ ] Hujjat havolasi bosilganda manba hujjat sahifasi ochiladi
- [ ] Mobile table pattern: desktop table + mobile cards
- [ ] Excel eksport

---

### T-211 — product_barcodes UI (TZ-04)

| Maydon | Qiymat |
|---|---|
| Owner | frontend-dev |
| Depends | T-201 |
| Files | `apps/web/app/(dashboard)/warehouse/products/page.tsx` |
| Size | M |
| Priority | P1 |

**Acceptance criteria:**
- [ ] Tovar kartasida "Shtrix-kodlar" bloki
- [ ] Qo'shish, asosiy belgilash, deaktivatsiya tugmalari
- [ ] Skanerlashda noma'lum kod → modal (yaratish/bog'lash/o'tkazish)

---

### T-212 — inventory_scan_events frontend + parallel scan UI (TZ-12)

| Maydon | Qiymat |
|---|---|
| Owner | frontend-dev |
| Depends | T-205 |
| Files | `apps/web/app/(dashboard)/warehouse/revision/` |
| Size | L |
| Priority | P1 |

**Acceptance criteria:**
- [ ] Ko'r rejim toggle (is_blind)
- [ ] To'xtatish / davom ettirish tugmalari
- [ ] "Tasdiqlash uchun yuborish" va admin tasdiqlash UI
- [ ] Progress bar: tekshirilgan/jami, kamomad, ortig'

---

### T-213 — supply_items qisman qabul (TZ-06)

| Maydon | Qiymat |
|---|---|
| Owner | backend-dev |
| Depends | T-200 |
| Files | `warehouse/router.py`, `supply/purchases/page.tsx` |
| Size | M |
| Priority | P1 |

**Acceptance criteria:**
- [ ] `supply_items.received_qty` ustun qo'shilgan
- [ ] `POST /warehouse/supplies/{id}/partially-receive` — `received_qty` qabul qilinadi
- [ ] Qisman qabul — faqat `received_qty` miqdorida stock oshadi
- [ ] Status `partially_received` ga o'tadi

---

### T-214 — reorder list va draft PO yaratish (TZ-11)

| Maydon | Qiymat |
|---|---|
| Owner | backend-dev + frontend-dev |
| Depends | - |
| Files | `warehouse/router.py`, yangi `reorder-list/page.tsx` |
| Size | M |
| Priority | P1 |

**Acceptance criteria:**
- [ ] `GET /warehouse/reorder-list` — minimal qoldiqdan past tovarlar (per warehouse)
- [ ] `POST /warehouse/reorder-list/create-draft-po` — bulk PO yaratish
- [ ] Frontend sahifada "Zakupka yaratish" tugmasi

---

### T-215 — sale_items.cost va COGS hisobi (TZ-15)

| Maydon | Qiymat |
|---|---|
| Owner | backend-dev |
| Depends | T-202 |
| Files | `sale/router.py`, `schema_patches.py`, `statistics/router.py` |
| Size | M |
| Priority | P1 |

**Acceptance criteria:**
- [ ] `sale_items.cost` sotuv tasdiqlashda `avg_cost` dan to'ldiriladi
- [ ] `GET /statistics/cogs-report` — COGS, yalpi foyda, marja
- [ ] Moliya huquqisiz foydalanuvchiga narx/tannarx yashiriladi

---

### T-216 — supplier_returns frontend sahifasi (TZ-10)

| Maydon | Qiymat |
|---|---|
| Owner | frontend-dev |
| Depends | T-204 |
| Files | `apps/web/app/(dashboard)/supply/supplier-returns/page.tsx` |
| Size | M |
| Priority | P1 |

**Acceptance criteria:**
- [ ] Ro'yxat: ta'minotchi, sana, status, summa
- [ ] Yaratish modal: ta'minotchi, sklad, sabab, kompensatsiya usuli, tovarlar
- [ ] Status workflow tugmalari (submit, ship, complete, cancel)
- [ ] Menu.config.ts ga yangi menu elementi (permission bilan)

---

### T-217 — warehouses deaktivatsiya guard (TZ-01)

| Maydon | Qiymat |
|---|---|
| Owner | backend-dev |
| Depends | T-200 |
| Files | `warehouse/router.py` |
| Size | S |
| Priority | P1 |

**Acceptance criteria:**
- [ ] `DELETE /warehouse/warehouses/{id}` — ochiq internal_transfers, supplies, inventories borligini tekshiradi
- [ ] Stock qoldiq noldan katta bo'lsa 422 qaytariladi
- [ ] Faqat `is_active=false` qo'yiladi, fizik o'chirish yo'q

---

### T-218 — products holat va asosiy supplier (TZ-03, TZ-05)

| Maydon | Qiymat |
|---|---|
| Owner | backend-dev |
| Depends | - |
| Files | `schema_patches.py`, `warehouse/router.py` |
| Size | S |
| Priority | P1 |

**Acceptance criteria:**
- [ ] `products.is_archived BOOLEAN DEFAULT FALSE` qo'shilgan
- [ ] `products.default_supplier_id UUID REFERENCES suppliers(id)` qo'shilgan
- [ ] Arxivlangan tovar yangi operatsiyalarda 422 qaytaradi
- [ ] `is_archived=true` bilan filter imkoni

---

### T-219 — write_offs operation_type (TZ-09)

| Maydon | Qiymat |
|---|---|
| Owner | backend-dev |
| Depends | - |
| Files | `schema_patches.py`, `warehouse/router.py` |
| Size | S |
| Priority | P1 |

**Acceptance criteria:**
- [ ] `write_offs.operation_type VARCHAR(20) DEFAULT 'write_off'` — 'write_off' | 'posting'
- [ ] Oprihodovaniye endpoint — `operation_type='posting'`, `allow_negative=False` bilan stock oshiradi
- [ ] Frontend UI: spisaniye va oprihodovaniye alohida tab

---

### T-220 — finansovaya integratsiya: write_off → cash_movements (TZ-16)

| Maydon | Qiymat |
|---|---|
| Owner | backend-dev |
| Depends | T-219 |
| Files | `finance/router.py`, `warehouse/router.py` |
| Size | S |
| Priority | P1 |

**Acceptance criteria:**
- [ ] Spisaniye paytida ixtiyoriy `cash_movement` (internal expense) yaratish
- [ ] `supplier_return` — pul qaytarish tanlaganda `cash_movements (direction=in)` yaratiladi
- [ ] `cash_movements.supplier_return_id` FK qo'shilgan (T-204 keyin)

---

## Sprint 7 — P2 (Yaxshi bo'lardi)

Taxminiy davomiylik: **7-10 ish kuni**

---

### T-230 — TZ-14 reports kengaytirish

| Maydon | Qiymat |
|---|---|
| Owner | backend-dev + frontend-dev |
| Depends | T-200, T-204, T-215 |
| Files | `statistics/router.py`, yangi hisobot sahifalari |
| Size | L |
| Priority | P2 |

**Acceptance criteria:**
- [ ] Qoldiqlar hisoboti (per warehouse, per category)
- [ ] Harakat hisoboti (davr bo'yicha, T-200 asosida)
- [ ] Zakupka hisoboti (ta'minotchi, tovar, narx dinamikasi)
- [ ] Spisaniye hisoboti (sabab, tovar, xodim bo'yicha)
- [ ] Ta'minotchi hisoboti (zakupka hajmi, qaytarishlar)
- [ ] Barcha hisobotlar uchun Excel eksport

---

### T-231 — audit log entity-specific filter (TZ-18)

| Maydon | Qiymat |
|---|---|
| Owner | frontend-dev |
| Depends | - |
| Files | UI komponent |
| Size | S |
| Priority | P2 |

**Acceptance criteria:**
- [ ] Tovar kartasida audit log tab
- [ ] Shtrix-kod o'zgarishlari alohida ko'rinadi
- [ ] Narx o'zgarishlari `price_history` dan

---

### T-232 — Idempotency-Key middleware (TZ-19 + POS)

| Maydon | Qiymat |
|---|---|
| Owner | backend-dev |
| Depends | T-200 |
| Files | `apps/api/app/core/` yangi idempotency middleware |
| Size | M |
| Priority | P2 |

**Acceptance criteria:**
- [ ] `Idempotency-Key` header qo'llab-quvvatlanadi
- [ ] `stock_movements.external_id` orqali takroriy so'rovlar aniqlanadi
- [ ] Bir xil key bilan ikkinchi so'rovda cached response qaytariladi

---

### T-233 — suppliers.contact_person va ta'minotchi balans (TZ-05)

| Maydon | Qiymat |
|---|---|
| Owner | backend-dev |
| Depends | T-204 |
| Files | `schema_patches.py`, `supplier/router.py` |
| Size | S |
| Priority | P2 |

**Acceptance criteria:**
- [ ] `suppliers.contact_person VARCHAR(150)` qo'shilgan
- [ ] Ta'minotchi kartasida zakupkalar va qaytarishlar statistikasi

---

### T-234 — inventory_items optimistic lock (TZ-19)

| Maydon | Qiymat |
|---|---|
| Owner | backend-dev |
| Depends | T-205 |
| Files | `warehouse/router.py` |
| Size | S |
| Priority | P2 |

**Acceptance criteria:**
- [ ] `inventory_items.version INT DEFAULT 1` qo'shilgan
- [ ] UPDATE: `WHERE id=:id AND version=:v` → 0 rows → 409 Conflict
- [ ] Frontend optimistic retry strategiyasi

---

## Ticket umumiy ko'rinishi

| Sprint | Ticket | Size | Priority | Status |
|---|---|---|---|---|
| 5 | T-200 stock_movements journal | L | P0 | TODO |
| 5 | T-201 product_barcodes extend | M | P0 | TODO |
| 5 | T-202 sale stock deduction | M | P0 | TODO |
| 5 | T-203 cashbox warehouse_id | S | P0 | TODO |
| 5 | T-204 supplier_returns | L | P0 | TODO |
| 5 | T-205 inventory rich states | L | P0 | TODO |
| 5 | T-206 RBAC permissions | S | P0 | TODO |
| 6 | T-210 movements frontend | M | P1 | TODO |
| 6 | T-211 barcodes UI | M | P1 | TODO |
| 6 | T-212 inventory parallel UI | L | P1 | TODO |
| 6 | T-213 supply partial receive | M | P1 | TODO |
| 6 | T-214 reorder list | M | P1 | TODO |
| 6 | T-215 COGS | M | P1 | TODO |
| 6 | T-216 supplier-returns UI | M | P1 | TODO |
| 6 | T-217 warehouse deactivate | S | P1 | TODO |
| 6 | T-218 products status/supplier | S | P1 | TODO |
| 6 | T-219 write_offs type | S | P1 | TODO |
| 6 | T-220 finance integration | S | P1 | TODO |
| 7 | T-230 reports | L | P2 | TODO |
| 7 | T-231 audit entity filter | S | P2 | TODO |
| 7 | T-232 idempotency | M | P2 | TODO |
| 7 | T-233 supplier contact | S | P2 | TODO |
| 7 | T-234 optimistic lock | S | P2 | TODO |
