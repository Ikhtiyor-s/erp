# T-4 — import-register-fixes

## Goal

Ikki HIGH zaiflikni yopish: (HI-4) `import_customers` da session corruption xavfini
bartaraf etish — bulk INSERT'ni 500 qatorli chunk'larga bo'lish va xato bo'lganda rollback
+ qaysi row sabab ekanini qaytarish; (HI-5) `register` endpoint'da yangi tashkilot uchun
yaratilgan admin roli global `organization_id IS NULL` admin roli'ga link qilinmasdan
org-scoped klon sifatida yaratilishi.

## Acceptance criteria

### HI-4: import_customers

- `POST /api/v1/customer/import` 1500 qatorli CSV → har 500 qatorda chunk ishlaydi, DB session timeout bermaydi
- Har chunk `db.execute(bulk_insert)` + `await db.flush()` patterni (yoki ekvivalent batch INSERT)
- 47-qatorda xato bo'lsa → response: `{"imported": 0, "errors": [{"row": 47, "error": "..."}]}`, butun import rollback qilinadi
- `db.rollback()` xato qatordan keyin chaqiriladi — qisman import qolmaydi
- Muvaffaqiyatli import response: `{"imported": N, "errors": []}`, 200

### HI-5: register org-scoped admin role

- `POST /api/v1/auth/register` yangi org yaratganda — `roles` jadvalida yangi yozuv bor: `name = "admin"`, `organization_id = new_org_id` (IS NOT NULL)
- Bu yangi rol tizim "admin" rol template'dan huquqlarni klonlab oladi, lekin alohida yozuv
- Yangi foydalanuvchiga tayinlangan `role_id` — `organization_id IS NULL` bo'lgan global rol emas, yangi org-scoped rol
- `SELECT role_id FROM user_roles WHERE user_id = :uid` → role `organization_id` = `new_org_id`
- Ikki xil org ro'yxatdan o'tsa — `roles` jadvalida ikki xil `organization_id` bilan ikki xil admin yozuvi

## Files likely touched

- `apps/api/app/modules/customer/router.py` (satırlar 361-392)
- `apps/api/app/modules/auth/router.py` (satırlar 57-63)

## Owner role

`backend-dev`

## Depends on

`none`

## Estimated effort

M (2 soat)
