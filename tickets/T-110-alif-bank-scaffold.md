# T-110: Backend — Alif Bank service scaffold

**Wave:** 4B
**Owner:** backend-dev
**Size:** S
**Depends on:** T-100

## Goal
`AlifService(IntegrationBase)` scaffold — settings save/load, test_connection() mock, webhook receiver stub.

## Files likely touched
- `apps/api/app/modules/integration/payments/alif.py` (yangi)
- `apps/api/app/modules/integration/router.py` (provider ro'yxatga qo'shish)

## Settings shape (JSONB, secret_box encrypted fields)
```json
{
  "alif": {
    "enabled": false,
    "merchant_id": "",
    "api_key": "",
    "sandbox": true
  }
}
```

## Acceptance criteria
- `AlifService` `IntegrationBase`'dan meros oladi.
- `test_connection()`: credentials bo'sh bo'lsa `{"ok": false, "error": "credentials_missing"}`; credentials to'liq bo'lsa mock `{"ok": true, "provider": "alif"}` (real API call yo'q — sandbox URL yo'q).
- `POST /integrations/alif/webhook` — 200 qaytaradi, body log'ga tushadi (stub).
- `api_key` `secret_box.encrypt()` bilan saqlanadi.
- audit log `api_key` ni redact qiladi (`SENSITIVE_KEYS`'ga qo'shish).

## How we'll know it's done
`POST /integrations/alif/settings` + `POST /integrations/alif/test-connection` 200 qaytaradi; `GET /integrations/status` `"alif"` entry'ni o'z ichiga oladi.
