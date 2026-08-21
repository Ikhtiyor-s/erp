# T-3 — mxik-backend-tests

## Goal

`apps/api/tests/test_warehouse.py` (yoki yangi `test_warehouse_mxik.py`) faylida MXIK
validatsiya va cross-tenant izolyatsiya uchun pytest testlari yozish va o'tkaz olish.

## Acceptance criteria

- `pytest apps/api/tests/ -v` barcha yangi testlar uchun PASSED qaytaradi
- Quyidagi holatlar uchun alohida test funksiyalari mavjud:

  1. **valid_mxik_create**: `mxik = "0902103000"` bilan mahsulot yaratish — 201, response'da
     `mxik` field to'g'ri
  2. **valid_mxik_max_length**: `mxik = "12345678901234567"` (17 raqam) — 201
  3. **valid_mxik_null**: `mxik = null` — 201, `mxik` field response'da `null`
  4. **invalid_mxik_too_short**: `mxik = "123"` — 422
  5. **invalid_mxik_too_long**: `mxik = "123456789012345678"` (18 raqam) — 422
  6. **invalid_mxik_non_digit**: `mxik = "ABC1234567"` — 422
  7. **cross_tenant_mxik_isolation**: `Org A` tokeni bilan `Org B` mahsulotini `GET` qilish —
     404 qaytadi va `Org B`ning `mxik` ma'lumoti response'da yo'q
  8. **update_mxik**: mavjud mahsulotga `PATCH/PUT` orqali `mxik` yangilash — 200, yangi
     qiymat saqlangan

- Har test izolyatsiyalangan (fixtures orqali DB state tozalanadi)
- `organization_id` filter mavjudligi: cross-tenant test `Org B` product ID'si bilan
  `Org A` session'da so'rov yuborib 404 tekshiradi

## Files likely touched

- `apps/api/tests/test_warehouse.py` (mavjud bo'lsa, yangi funksiyalar qo'shiladi)
  yoki `apps/api/tests/test_warehouse_mxik.py` (yangi fayl, agar mavjudi juda katta)

## Owner role

`backend-dev`

## Depends on

`T-1` (schema va validator tayyor bo'lishi shart)

## Estimated effort

S (1 soat)
