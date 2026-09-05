# T-203 — product_barcodes Alohida Jadval + is_primary + is_active + Tarix

**Owner Role**: both (backend-dev + frontend-dev)
**Depends On**: none
**Blocks**: none
**Estimated Size**: M (1-3 kun)
**Priority**: P0
**TZ Reference**: TZ-04

---

## Rationale

Hozirda `products.barcode` (bitta VARCHAR) va `products.extra_barcodes` (JSONB array) mavjud. Bu yondashuv barcode tarixini saqlashga, birlamchi/ikkilamchi belgilashga, va deaktivatsiya bilan arxivlashga imkon bermaydi. TZ-04 talabi: har mahsulotda bir nechta faol barcode, bitta asosiy (is_primary), eski barcodelar deaktivatsiya bilan arxivda saqlanishi. Barcode bo'yicha tezkor mahsulot qidiruvini ham ta'minlash kerak (POS skanerlash).

---

## Files Likely Touched

- **DB**: `apps/api/app/db/schema_patches.py` — yangi jadval va partial unique index; migration script
- **Backend**: `apps/api/app/modules/warehouse/router.py` — yangi endpoint guruh
- **RBAC**: `apps/api/app/modules/rbac/permissions.py` — `warehouse.manage_barcodes`
- **Frontend**: `apps/web/app/(dashboard)/warehouse/products/page.tsx` — barcode bloki
- **i18n**: `apps/web/i18n/messages/uz.json`, `ru.json`, `en.json`
- **Tests**: `apps/api/tests/test_product_barcodes.py`

---

## Acceptance Criteria

### DB Schema
- [ ] `product_barcodes(id UUID PK DEFAULT gen_random_uuid(), organization_id UUID NOT NULL FK organizations, product_id UUID NOT NULL FK products ON DELETE CASCADE, barcode VARCHAR(100) NOT NULL, is_primary BOOLEAN DEFAULT FALSE, is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW(), deactivated_at TIMESTAMPTZ NULLABLE, created_by UUID NULLABLE FK users)` — `CREATE TABLE IF NOT EXISTS`
- [ ] Partial unique index: `CREATE UNIQUE INDEX IF NOT EXISTS uq_product_barcodes_active ON product_barcodes (organization_id, barcode) WHERE is_active = TRUE`
- [ ] Index: `(organization_id, product_id)`
- [ ] **Migration**: `schema_patches.py`da migration patch — mavjud `products.barcode` (non-null) va `products.extra_barcodes` (JSONB)'dan `product_barcodes`ga ko'chirish:
  - `products.barcode IS NOT NULL` bo'lgan har qator uchun `is_primary=TRUE, is_active=TRUE` yozuvi
  - `extra_barcodes` JSONB array elementi uchun `is_primary=FALSE, is_active=TRUE` yozuvlari
  - Migration idempotent bo'lishi shart (qayta ishlaganda dublikat yaratmasin)

### Backend Endpoints
- [ ] `GET /warehouse/products/{pid}/barcodes` — mahsulot barcha barcodelar (is_active filtri bilan, default: barcha)
- [ ] `POST /warehouse/products/{pid}/barcodes` body: `{barcode: str}` — yangi qo'shish, agar faol dublikat → 409 Conflict
- [ ] `POST /warehouse/products/{pid}/barcodes/{bid}/set-primary` — belgilangan barcode `is_primary=TRUE`, avvalgisi `is_primary=FALSE`
- [ ] `POST /warehouse/products/{pid}/barcodes/{bid}/deactivate` — `is_active=FALSE, deactivated_at=NOW()`, `is_primary=FALSE`, audit log
- [ ] `POST /warehouse/products/{pid}/barcodes/{bid}/reactivate` — `is_active=TRUE`, agar shu barcode boshqa mahsulotda faol bo'lsa 409
- [ ] `GET /warehouse/barcode-lookup?q={code}&org_id={...}` — faol barcode bo'yicha mahsulot topish (POS skanerlash uchun)
- [ ] Har deaktivatsiya/reaktivatsiya audit log'ga yoziladi

### Frontend
- [ ] Product form/modal ichida "Shtrix-kodlar" bloki — mavjud `extra_barcodes` textarea o'rniga
- [ ] Blok: barcode qatori, "Asosiy" badge, "Deaktivatsiya" tugmasi, "Qo'shish" tugmasi
- [ ] Deaktivatsiya `<ConfirmDialog>` orqali tasdiqlanadi (`window.confirm()` taqiqlangan)
- [ ] `is_active=FALSE` barcodelar kulrang, ustiga chizilgan ko'rinishda (strikethrough)
- [ ] Barcode lookup: yangi noma'lum kod skanerlanganda — "Mahsulot topilmadi" xabari

### Tests
- [ ] `test_product_barcodes.py`: yangi barcode qo'shish ishlaydi
- [ ] `test_product_barcodes.py`: dublikat faol barcode → 409
- [ ] `test_product_barcodes.py`: set-primary bir vaqtda faqat bitta primary bo'ladi
- [ ] `test_product_barcodes.py`: deaktivatsiya → barcode endi lookup'da topilmaydi
- [ ] `test_product_barcodes.py`: migration patch mavjud barcode'ni ko'chiradi (idempotent)

---

## Technical Notes

- **WON'T DO bu ticketda**: POS skanerdan real-time barcode o'qish (T-134 da bor). Bu ticket faqat CRUD va lookup.
- `products.barcode` ustunini DROP qilmang — T-211 kabi legacy deprecation keyinchalik alohida ticket.
- Partial unique index `WHERE is_active = TRUE` — deaktivatsiya qilingan barcode boshqa mahsulotga berilishi mumkin.
- `barcode-lookup` endpoint auth kerak, org_id filter majburiy.
- **Antipattern**: `extra_barcodes` JSONB ni to'g'ridan-to'g'ri query qilmang — migratsiyadan keyin faqat `product_barcodes` jadvalidan foydalaning.

---

## Definition of Done

- [ ] Mechanical: `pytest apps/api/tests/test_product_barcodes.py -v` — 0 fail
- [ ] Mechanical: `psql -c "SELECT COUNT(*) FROM product_barcodes"` — migration qilingan yozuvlar mavjud
- [ ] Agentic: qa-reviewer BLOCKER yo'q
- [ ] Behavioral: mahsulot formasida eski barcode ko'rinadi, yangi qo'shiladi, dublikat 409 beradi
- [ ] Human-gate: merge
