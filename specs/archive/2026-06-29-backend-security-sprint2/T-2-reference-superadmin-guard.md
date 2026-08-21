# T-2 — reference-superadmin-guard

## Goal

`reference/router.py` da global reference yozuvlari (`organization_id IS NULL`) uchun
`PUT` va `DELETE` operatsiyalarini faqat `is_superadmin = TRUE` foydalanuvchilarga cheklash;
oddiy admin va boshqa rollar o'z `organization_id`'lariga mos yozuvlarni o'zgartira olsin,
lekin global yozuvlarga 403 qaytarsin.

## Acceptance criteria

- `PUT /api/v1/reference/{id}` — `id` ga mos yozuvning `organization_id IS NULL` bo'lsa va so'rov yuboruvchi `is_superadmin = FALSE` bo'lsa → 403 Forbidden qaytadi
- `DELETE /api/v1/reference/{id}` — yuqoridagi bir xil sharoit → 403 Forbidden qaytadi
- `PUT /api/v1/reference/{id}` — `id` ga mos yozuvning `organization_id = caller_org_id` bo'lsa → 200, o'zgarish saqlanadi
- Superadmin `organization_id IS NULL` yozuvni o'zgartirsa → 200
- Tekshirish qo'shimcha DB query sifatida amalga oshiriladi: avval yozuv `organization_id` si o'qiladi, so'ng caller huquqi baholanadi
- Global yozuvni o'zgartirish urinishi audit log'da yoziladi (`event_type = "forbidden_global_reference_write"`, `record_id`, `caller_org_id`)
- Mavjud barcha testlar PASS

## Files likely touched

- `apps/api/app/modules/reference/router.py`

## Owner role

`backend-dev`

## Depends on

`none`

## Estimated effort

S (1 soat)
