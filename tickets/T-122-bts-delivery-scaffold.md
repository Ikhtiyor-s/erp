# T-122: Backend — BTS Delivery service scaffold

**Wave:** 4C
**Owner:** backend-dev
**Size:** S
**Depends on:** T-100

## Goal
`BTSDeliveryService(IntegrationBase)` scaffold — T-121 bilan bir xil pattern.

## Files likely touched
- `apps/api/app/modules/integration/delivery/bts.py` (yangi)
- `apps/api/app/modules/integration/router.py`

## Settings shape
```json
{
  "bts_delivery": {
    "enabled": false,
    "api_key": "",
    "account_id": "",
    "sandbox": true
  }
}
```

## Acceptance criteria
- T-121 pattern (IntegrationBase, test_connection mock, stub endpoints).
- `api_key` secret_box encrypt + SENSITIVE_KEYS.

## How we'll know it's done
`GET /integrations/status`'da `"bts_delivery"` ko'rinadi.
