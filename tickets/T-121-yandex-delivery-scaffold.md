# T-121: Backend — Yandex Delivery service scaffold

**Wave:** 4C
**Owner:** backend-dev
**Size:** S
**Depends on:** T-100

## Goal
`YandexDeliveryService(IntegrationBase)` — yuk yaratish va narx hisoblash stub.

## Files likely touched
- `apps/api/app/modules/integration/delivery/yandex.py` (yangi)
- `apps/api/app/modules/integration/router.py`

## Settings shape
```json
{
  "yandex_delivery": {
    "enabled": false,
    "oauth_token": "",
    "sender_id": "",
    "sandbox": true
  }
}
```

## New endpoints
```
POST /integrations/yandex-delivery/estimate  — narx hisoblash stub
POST /integrations/yandex-delivery/create    — yuk yaratish stub
GET  /integrations/yandex-delivery/track/{id} — kuzatish stub
```

## Acceptance criteria
- T-110 pattern (IntegrationBase, test_connection mock, SENSITIVE_KEYS).
- Barcha endpoint'lar stub JSON qaytaradi (`{"status": "stub", "message": "credentials_required"}`).
- `oauth_token` secret_box encrypt.

## How we'll know it's done
`GET /integrations/status`'da `"yandex_delivery"` ko'rinadi; estimate endpoint 200 stub qaytaradi.
