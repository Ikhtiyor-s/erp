# T-120: Backend — Didox e-faktura service scaffold

**Wave:** 4C
**Owner:** backend-dev
**Size:** M
**Depends on:** T-100, T-101

## Goal
`DidoxService(IntegrationBase)` — e-faktura yaratish va yuborish stub, MXIK kod integratsiyasi.

## Files likely touched
- `apps/api/app/modules/integration/didox.py` (yangi)
- `apps/api/app/modules/integration/router.py`
- `apps/api/app/modules/sale/router.py` (sale'dan e-faktura generate endpoint)

## Settings shape
```json
{
  "didox": {
    "enabled": false,
    "stir": "",
    "api_token": "",
    "sandbox": true
  }
}
```

## New endpoints
```
POST /integrations/didox/invoice  — sale_id dan e-faktura yaratish (stub)
GET  /integrations/didox/invoice/{id}/status — holat tekshirish (stub)
```

## Acceptance criteria
- `DidoxService` `IntegrationBase`'dan meros oladi.
- `test_connection()`: STIR + token to'liq bo'lsa `{"ok": true}` mock; aks holda `{"ok": false}`.
- `POST /integrations/didox/invoice`: sale ni oladi → MXIK kod mavjud bo'lsa invoice payload yaratadi → stub response `{"invoice_id": "stub-123", "status": "draft"}`.
- `api_token` secret_box encrypt + SENSITIVE_KEYS.
- MXIK kod sale_items'da yo'q bo'lsa warning qaytaradi (blocker emas).

## How we'll know it's done
Sale'dan `POST /integrations/didox/invoice` chaqirilsa stub response 200; Didox disabled bo'lsa 400.
