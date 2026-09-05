# T-209 — products.is_archived + default_supplier_id + Arxiv Flow

**Owner Role**: both (backend-dev + frontend-dev)
**Depends On**: none
**Blocks**: none
**Estimated Size**: S (< 1 kun)
**Priority**: P0
**TZ Reference**: TZ-03

---

## Rationale

Hozirda mahsulot `is_active=FALSE` bilan o'chiriladi — lekin bu "vaqtincha to'xtatilgan" va "arxivlangan" holatlarni farqlamaydi. TZ-03 talabi: arxiv — mahsulot endi sotilmaydi, lekin tarix (harakatlar, hisobotlar) saqlanadi. Bundan tashqari, har mahsulotning asosiy ta'minotchisi (`default_supplier_id`) belgilanishi kerak — bu zakupka formida avtomatik preselect uchun kerak.

---

## Files Likely Touched

- **DB**: `apps/api/app/db/schema_patches.py` — ikki ustun
- **Backend**: `apps/api/app/modules/warehouse/router.py` — mahsulot ro'yxati filter, arxiv/qaytarish endpoint
- **Frontend**: `apps/web/app/(dashboard)/warehouse/products/page.tsx` — arxiv toggle, filter
- **Frontend**: `apps/web/app/(dashboard)/supply/purchases/page.tsx` — default supplier preselect
- **i18n**: `apps/web/i18n/messages/uz.json`, `ru.json`, `en.json`
- **Tests**: `apps/api/tests/test_product_archive.py`

---

## Acceptance Criteria

### DB Schema
- [ ] `ALTER TABLE products ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE`
- [ ] `ALTER TABLE products ADD COLUMN IF NOT EXISTS default_supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL`
- [ ] Index: `(organization_id, is_archived)` — filtrlash uchun

### Backend — Arxiv Logikasi
- [ ] `GET /warehouse/products` default filter: `is_archived = FALSE` (hozirgi `is_active` filter saqlanadi)
- [ ] `GET /warehouse/products?include_archived=true` — arxivlangan mahsulotlarni ham ko'rsatadi
- [ ] `POST /warehouse/products/{id}/archive` — `is_archived = TRUE`; agar mahsulotda ochiq sotuv/xarid borligini tekshirish (agar bor → 422 "Mahsulotni arxivlab bo'lmaydi: ochiq operatsiyalar mavjud")
- [ ] `POST /warehouse/products/{id}/unarchive` — `is_archived = FALSE`
- [ ] Arxivlangan mahsulot yangi sotuv/xarid'ga qo'shilishiga 422 bilan to'siq
- [ ] `PATCH /warehouse/products/{id}` — `default_supplier_id` yangilash qabul qiladi
- [ ] `GET /warehouse/products/{id}` — response'da `is_archived`, `default_supplier_id`, `default_supplier_name` mavjud

### Frontend — Mahsulotlar Ro'yxati
- [ ] Jadvalda "Arxiv" toggle filter (checkbox yoki segment)
- [ ] Arxivlangan mahsulot qatorlari kulrang/italik ko'rinishda
- [ ] Har qatorda "Arxiv" / "Arxivdan chiqarish" tugmasi — `<ConfirmDialog>` bilan
- [ ] Mahsulot edit modal'ida "Asosiy ta'minotchi" dropdown (suppliers ro'yxati)

### Frontend — Zakupka Formi (supply/purchases)
- [ ] Zakupka formasida mahsulot qo'shilganda `default_supplier_id` bor bo'lsa supplier avtomatik preselect qilinadi
- [ ] Preselect faqat taklif — foydalanuvchi o'zgartirishi mumkin

### Tests
- [ ] `test_product_archive.py`: archive → mahsulot `GET /products` da ko'rinmaydi (default filter)
- [ ] `test_product_archive.py`: `include_archived=true` bilan ko'rinadi
- [ ] `test_product_archive.py`: arxivlangan mahsulotni yangi sotuvga qo'shish → 422
- [ ] `test_product_archive.py`: unarchive → yana ko'rinadi
- [ ] `test_product_archive.py`: `default_supplier_id` PATCH va GET

---

## Technical Notes

- **Antipattern**: `is_archived = TRUE` bo'lganda mahsulotni DB'dan DELETE qilmang — tarix yo'qoladi.
- `is_active = FALSE` va `is_archived = TRUE` — ikki alohida flag. Arxivlash `is_active`'ni o'zgartirmaydi.
- Ochiq operatsiyalar tekshiruvi: `sales` (status IN ('draft','confirmed')), `supply_items` (status != 'received') JOIN orqali product_id tekshiriladi — SQL'da `EXISTS` subquery.
- `default_supplier_id` — `ON DELETE SET NULL` (supplier o'chirilsa, link yo'qoladi, mahsulot saqlanadi).

---

## Definition of Done

- [ ] Mechanical: `pytest apps/api/tests/test_product_archive.py -v` — 0 fail
- [ ] Mechanical: `psql -c "\d products"` — `is_archived`, `default_supplier_id` ko'rinadi
- [ ] Agentic: qa-reviewer BLOCKER yo'q
- [ ] Behavioral: mahsulot arxivlanadi → POS'da ko'rinmaydi → arxivdan chiqariladi → yana ko'rinadi
- [ ] Human-gate: merge
