# T-201 — Sale allow_negative Guard + _stock_apply Unified

**Owner Role**: backend-dev
**Depends On**: none (T-200 bilan parallel, lekin T-200 merge bo'lgach `_write_movement` integratsiya qo'shiladi)
**Blocks**: none
**Estimated Size**: M (1-3 kun)
**Priority**: P0 — URGENT prod bug
**TZ Reference**: TZ-02

---

## Rationale

`apps/api/app/modules/sale/router.py` hozirda 3 ta joyda (`~line 171`, `~line 540`, `~line 943`) `stock_balances`ni to'g'ridan-to'g'ri `UPDATE` qiladi — `_stock_apply` service funksiyasini chaqirmaydi. Bu ikkita kritik muammo keltirib chiqaradi: (1) manfiy qoldiq cheklanmaydi — kassa menejer noldan past sotuv tasdiqlashi mumkin; (2) harakat jurnali yozilmaydi (T-200 bo'lsa ham). Prod muhitda o'z-o'zidan manfiy stok paydo bo'lyapti. Bu ticket uch joyni ham `_stock_apply` orqali o'tkazadi va `allow_negative=False` qoidasini joriy qiladi.

---

## Files Likely Touched

- **Backend**: `apps/api/app/modules/sale/router.py` — sotuv tasdiqlash, qaytarish, va boshqa direct UPDATE joylarini refactor
- **Backend service**: `apps/api/app/modules/warehouse/service.py` — `_stock_apply` signature T-200 bilan moslashtiriladi
- **Tests**: `apps/api/tests/test_sale_stock.py` — yangi test fayl (yoki mavjudga qo'shish)

---

## Acceptance Criteria

- [ ] `sale/router.py`da `stock_balances` ga to'g'ridan-to'g'ri `UPDATE ... SET quantity = quantity - ...` kabi raw SQL yo'q — grep bilan tekshiriladi
- [ ] Sotuv tasdiqlash (`POST /sale/sales/{id}/confirm`) har `sale_item` uchun `_stock_apply(warehouse_id, product_id, delta=-qty, allow_negative=False, operation_type="sale", source_document_type="sale", source_document_id=sale_id, user_id=...)` chaqiradi
- [ ] Yetarli qoldiq yo'q bo'lganda `_stock_apply` 422 Unprocessable Entity tashlaydi, sotuv holati `draft`da qoladi
- [ ] Sotuv qaytarish (`POST /sale/sales/{id}/return`) `_stock_apply(delta=+qty, operation_type="sale_return")` chaqiradi
- [ ] BOM mahsulot uchun: `explode_bom` dan kelgan har komponent alohida `_stock_apply` chaqiruvi oladi
- [ ] `test_sale_negative_stock_blocked`: stock=5 bo'lganda qty=10 ga sotuv tasdiqlash → 422, stock hamon 5
- [ ] `test_sale_stock_deducted`: stock=10 bo'lganda qty=3 ga sotuv tasdiqlash → 200, stock 7 ga tushadi
- [ ] `test_sale_return_stock_restored`: sotuv qaytarilganda stock avvalgi qiymatiga qaytadi
- [ ] T-200 merge bo'lgandan keyin: har sotuv tasdiqlash `stock_movements`da yozuv paydo bo'ladi (integration test)

---

## Technical Notes

- **Antipattern**: `allow_negative=True` ni faqat shu holatlarda ishlatish ruxsat: `write_off` (inventory adjust), `oprihodovanie`. Savdo (sale) hech qachon manfiy qoldiqqa yo'l qo'ymaydi.
- `sale/router.py`da `from app.modules.warehouse.service import _stock_apply` import mavjudligi tekshirilsin — mavjud bo'lmasa qo'shiladi (`explode_bom` import mavjud).
- Agar BOM mahsulot sotilayotgan bo'lsa va bitta komponent yetishmasa — **barcha** komponentlar uchun stock tekshiruvi yakunlanmay turib hech qaysisining qoldig'i kamaymasligi kerak (atomicity). Buning uchun avval barcha `_stock_qty` ni tekshiring, keyin barcha `_stock_apply` ni chaqiring.
- `sale/router.py`dagi qatorlarni o'zgartirishdan oldin atrofdagi kontekstni o'qing — boshqa shart bloklari bo'lishi mumkin.

---

## Definition of Done

- [ ] Mechanical: `pytest apps/api/tests/test_sale_stock.py -v` — 0 fail
- [ ] Mechanical: `grep -n "UPDATE stock_balances" apps/api/app/modules/sale/router.py` — 0 natija
- [ ] Agentic: qa-reviewer BLOCKER yo'qligini tasdiqlaydi
- [ ] Behavioral: POS orqali 0 qoldiqli mahsulotni sotishga urinish → xato modali ko'rinadi
- [ ] Human-gate: merge qilinadi
