# T-100: Backend — IntegrationBase framework

**Wave:** 4A
**Owner:** backend-dev
**Size:** M
**Depends on:** none

## Goal
`IntegrationBase` abstract class va per-org settings CRUD endpointlarini yaratish — barcha keyingi integratsiyalar shu poydevorga quriladi.

## Files likely touched
- `apps/api/app/modules/integration/base.py` (yangi fayl)
- `apps/api/app/modules/integration/router.py` (settings CRUD endpoint qo'shish)
- `apps/api/app/modules/rbac/permissions.py` (`integration.manage` permission)
- `apps/api/app/db/schema_patches.py` (agar `integrations_settings` alohida jadval kerak bo'lsa — hozir `app_settings` JSONB ishlatiladi)

## Acceptance criteria
- `IntegrationBase` abstract class mavjud: `provider_key: str`, `save_settings()`, `load_settings()`, `test_connection()` (abstract), `is_enabled()`.
- `save_settings()` qiymatlarni `secret_box.encrypt()` orqali saqlaydi.
- `GET /integrations/status` — barcha registered provider'lar va ularning `enabled` holatini qaytaradi (hub T-130 uchun).
- `POST /integrations/{provider}/settings` — save.
- `POST /integrations/{provider}/test-connection` — `test_connection()` chaqiradi.
- RBAC: `integration.manage` permission admin va manager'ga grant qilingan.
- `organization_id` filter barcha SQL so'rovlarda mavjud.

## How we'll know it's done
`POST /integrations/alif/settings` (bo'sh payload) 200 qaytaradi; `GET /integrations/status` JSON array qaytaradi; mavjud Click va Payme integratsiyalari buzilmagan.
