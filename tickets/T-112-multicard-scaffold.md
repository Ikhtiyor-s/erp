# T-112: Backend — Multicard service scaffold

**Wave:** 4B
**Owner:** backend-dev
**Size:** S
**Depends on:** T-100

## Goal
`MulticardService(IntegrationBase)` scaffold.

## Files likely touched
- `apps/api/app/modules/integration/payments/multicard.py` (yangi)
- `apps/api/app/modules/integration/router.py`

## Settings shape
```json
{
  "multicard": {
    "enabled": false,
    "api_key": "",
    "terminal_id": "",
    "sandbox": true
  }
}
```

## Acceptance criteria
- T-110 pattern (IntegrationBase, test_connection mock, webhook stub).
- `api_key` secret_box encrypt + SENSITIVE_KEYS.

## How we'll know it's done
`GET /integrations/status`'da `"multicard"` ko'rinadi.
