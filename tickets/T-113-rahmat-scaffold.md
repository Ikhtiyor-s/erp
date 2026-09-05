# T-113: Backend — Rahmat service scaffold

**Wave:** 4B
**Owner:** backend-dev
**Size:** S
**Depends on:** T-100

## Goal
`RahmatService(IntegrationBase)` scaffold.

## Files likely touched
- `apps/api/app/modules/integration/payments/rahmat.py` (yangi)
- `apps/api/app/modules/integration/router.py`

## Settings shape
```json
{
  "rahmat": {
    "enabled": false,
    "merchant_token": "",
    "secret": "",
    "sandbox": true
  }
}
```

## Acceptance criteria
- T-110 pattern.
- `merchant_token` + `secret` — secret_box encrypt + SENSITIVE_KEYS.

## How we'll know it's done
`GET /integrations/status`'da `"rahmat"` ko'rinadi.
