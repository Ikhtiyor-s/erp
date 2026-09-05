# T-111: Backend — Uzum Bank service scaffold

**Wave:** 4B
**Owner:** backend-dev
**Size:** S
**Depends on:** T-100

## Goal
`UzumService(IntegrationBase)` scaffold — T-110 bilan bir xil pattern.

## Files likely touched
- `apps/api/app/modules/integration/payments/uzum.py` (yangi)
- `apps/api/app/modules/integration/router.py`

## Settings shape
```json
{
  "uzum": {
    "enabled": false,
    "client_id": "",
    "client_secret": "",
    "sandbox": true
  }
}
```

## Acceptance criteria
- T-110 bilan bir xil pattern (IntegrationBase meros, test_connection mock, webhook stub).
- `client_secret` secret_box encrypt.
- `SENSITIVE_KEYS`'ga `client_secret` qo'shilgan.

## How we'll know it's done
T-110 bilan bir xil — `GET /integrations/status`'da `"uzum"` ko'rinadi.
