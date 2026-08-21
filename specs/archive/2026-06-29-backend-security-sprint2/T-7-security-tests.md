# T-7 — security-tests

## Goal

Sprint #2 dagi har bir CR va HI uchun pytest async testlar yozish — cross-tenant negative
case'lar (boshqa org ID bilan so'rov → 403/404/422), fail-CLOSED testlar, privilege
escalation testlar, normalize testlar. Mavjud 35 ta test PASS bo'lishi shart,
yangi ~15 ta test qo'shilishi kutiladi.

## Acceptance criteria

### Umumiy

- `docker exec erp-api pytest apps/api/tests/ -v` — hammasi PASS
- Mavjud 35 ta test hech biri FAIL qilmaydi (regression yo'q)
- Yangi test fayllar `pytest-asyncio` + `AsyncSession` fixture ishlatadi
- Har test alohida izolatsiyalangan fixture'da ishlaydi (`fresh_org` fixture — alohida `organization_id`)

### CR-1 testlar (`test_rbac_middleware.py`)

- `test_rbac_db_error_returns_503`: mock qilingan DB exception paytida himoyalangan endpoint → 503
- `test_rbac_db_error_audit_log`: 503 qaytganda `audit_logs`'da `rbac_check_failed` yozuvi bor

### CR-2 testlar (`test_rbac_middleware.py`)

- `test_export_requires_export_permission`: `sales.view` bor, `sales.export` yo'q foydalanuvchi `GET /sales/export` → 403
- `test_export_allowed_with_export_permission`: `sales.export` bor foydalanuvchi → 200

### CR-3 testlar (`test_rbac_middleware.py`)

- `test_organizations_settings_not_skipped`: `/api/v1/organizations/{id}/settings` so'rovi RBAC orqali o'tadi (permission bo'lmasa 403)
- `test_organizations_list_is_skipped`: `/api/v1/organizations/list` so'rovi 200 (RBAC skip)

### CR-4 testlar (`test_reference.py`)

- `test_admin_cannot_update_global_reference`: oddiy admin global (`org_id IS NULL`) yozuvni PUT → 403
- `test_admin_can_update_own_org_reference`: admin o'z org yozuvini PUT → 200
- `test_superadmin_can_update_global_reference`: superadmin global yozuvni PUT → 200

### HI-1 testlar (`test_sale.py`)

- `test_create_sale_cross_tenant_warehouse`: Org B warehouse → 422
- `test_create_sale_cross_tenant_product`: Org B product → 422
- `test_create_sale_own_org_success`: O'z org entity'lari → 201

### HI-2 testlar (`test_finance.py`)

- `test_create_movement_cross_tenant_cashbox`: Org B cashbox → 422
- `test_create_movement_own_org_success`: O'z cashbox → 201

### HI-3 testlar (`test_sale.py`)

- `test_pay_sale_cross_tenant_cashbox`: Org B cashbox bilan pay → 422, hech qanday DB o'zgarish yo'q
- `test_pay_sale_atomic_rollback`: cash_movements INSERT fail simulate → sale.status o'zgarmaydi

### HI-4 testlar (`test_customer.py`)

- `test_import_customers_invalid_row_rollback`: noto'g'ri qator bor CSV → 0 import, rollback, qaysi row ko'rsatiladi
- `test_import_customers_large_success`: 600 qatorli CSV → 600 import success (chunked)

### HI-5 testlar (`test_auth.py`)

- `test_register_admin_role_is_org_scoped`: register → admin rolning `organization_id IS NOT NULL` va yangi org'ga mos

### HI-6 testlar (`test_rbac.py`)

- `test_update_role_cannot_grant_missing_permission`: caller'da yo'q permission'ni grant → 403
- `test_update_role_can_grant_own_permission`: caller'da bor permission'ni grant → 200
- `test_superadmin_can_grant_any_permission`: superadmin → 200

### HI-7 testlar (`test_customer_portal.py`)

- `test_otp_phone_normalize_variants`: `998901234567` va `+998901234567` ikkalasi ham to'g'ri OTP yuboradi
- `test_otp_invalid_phone_format`: `"not-a-phone"` → 422

## Files likely touched

- `apps/api/tests/test_rbac_middleware.py` (yangi fayl)
- `apps/api/tests/test_reference.py` (yangi yoki mavjud)
- `apps/api/tests/test_sale.py` (yangi scenariolar)
- `apps/api/tests/test_finance.py` (yangi scenariolar)
- `apps/api/tests/test_customer.py` (yangi scenariolar)
- `apps/api/tests/test_auth.py` (yangi scenariolar)
- `apps/api/tests/test_rbac.py` (yangi scenariolar)
- `apps/api/tests/test_customer_portal.py` (yangi yoki mavjud)
- `apps/api/tests/conftest.py` (`fresh_org` fixture qo'shilishi mumkin)

## Owner role

`backend-dev`

## Depends on

`T-1`, `T-2`, `T-3`, `T-4`, `T-5`, `T-6`

## Estimated effort

M (2-3 soat)
