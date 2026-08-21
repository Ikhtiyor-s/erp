# T-1 — rbac-middleware-fix

## Goal

RBAC middleware'dagi uchta CRITICAL zaiflikni yopish: (1) DB xato bo'lsa fail-OPEN o'rniga
503 qaytarish va audit log yozish, (2) `export`/`import`/`report` suffix'li path'lar uchun
`module.view`'ga fallback o'rniga aniq permission mapping table qo'shish, (3) SKIP_PATHS
qamrovini `organizations*` wildcarddan faqat aniq kerakli ikki path'ga toraytirish.

## Acceptance criteria

- `apps/api/app/modules/rbac/middleware.py` da `except Exception` bloki `return await call_next(request)` chaqirmaydi — 503 `JSONResponse` qaytaradi
- 503 response body: `{"detail": "Service temporarily unavailable — authorization check failed"}`
- DB xato bo'lganda `audit_logs` jadvalida `event_type = "rbac_check_failed"`, `path`, `method`, `user_id` (agar mavjud bo'lsa) yozilgan
- `EXPORT_IMPORT_REPORT_MAP` (yoki shunga o'xshash) dict middleware faylida mavjud — `"export"` → `"module.export"`, `"import"` → `"module.import"`, `"report"` → `"module.report"` pattern'lar bilan
- `GET /api/v1/sales/export` uchun derive qilingan permission `sales.export` (EMAS `sales.view`)
- `GET /api/v1/finance/report` uchun derive `finance.report` (EMAS `finance.view`)
- SKIP_PATHS ro'yxatida `"/api/v1/organizations"` wildcard YO'Q
- SKIP_PATHS faqat aniq yo'llarni o'z ichiga oladi: `"/api/v1/organizations/list"` va `"/api/v1/organizations/{id}/switch"` (yoki regex pattern bilan aniq belgilangan)
- `GET /api/v1/organizations/settings` so'rovi RBAC'dan o'tadi (skip qilinmaydi) — permission yo'q bo'lsa 403
- Mavjud barcha testlar PASS (`docker exec erp-api pytest apps/api/tests/ -v`)

## Files likely touched

- `apps/api/app/modules/rbac/middleware.py`
- `apps/api/app/modules/audit/middleware.py` (audit event type qo'shilishi kerak bo'lsa)

## Owner role

`backend-dev`

## Depends on

`none`

## Estimated effort

M (2-3 soat)
