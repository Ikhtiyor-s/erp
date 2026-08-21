# T-5 — privilege-escalation-guard

## Goal

`rbac/router.py` dagi `update_role_permissions` endpoint'ga caller-owns-permission
tekshiruvi qo'shish: foydalanuvchi faqat o'zi ega bo'lgan permission'larni boshqa
rolga berishi mumkin; o'zida yo'q permission'ni berishga urinish → 403.

## Acceptance criteria

- `PUT /api/v1/rbac/roles/{role_id}/permissions` — request body'dagi permission'lar ro'yxati ichida caller'da mavjud bo'lmagan birorta bo'lsa → 403 Forbidden
- Xato response body: `{"detail": "You cannot grant permissions you do not have", "missing": ["settings.manage"]}`
- Caller faqat o'zida bor permission'larni qo'shsa → 200, permission saqlanadi
- `is_superadmin = TRUE` caller uchun self-check o'tkazilmaydi — 200 kafolatlanadi
- Tekshirish quyidagi yo'l bilan: `caller_permissions = set(get_current_user_permissions())`, `requested = set(body.permissions)`, `diff = requested - caller_permissions`, agar `diff` bo'sh emas → 403
- Mavjud permission'larni olib tashlash (DELETE) operatsiyasi uchun ham bir xil guard ishlaydi (agar endpoint shu yo'nalishda ham ishlasa)
- Mavjud barcha testlar PASS

## Files likely touched

- `apps/api/app/modules/rbac/router.py`

## Owner role

`backend-dev`

## Depends on

`none`

## Estimated effort

S (1 soat)
