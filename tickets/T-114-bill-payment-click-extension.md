# T-114: Backend — Bill/kommunal to'lov (Click kengaytirish)

**Wave:** 4B
**Owner:** backend-dev
**Size:** M
**Depends on:** T-100

## Goal
Click API orqali kommunal hisob to'lash — `POST /finance/bill-payment` endpoint.

## Files likely touched
- `apps/api/app/modules/integration/payments/click.py` (kengaytirish — bill payment method qo'shish)
- `apps/api/app/modules/finance/router.py` (yangi endpoint)
- `apps/api/app/modules/rbac/permissions.py` (`finance.bill_payment`)

## Request/Response
```json
POST /finance/bill-payment
{
  "bill_type": "electricity" | "gas" | "water" | "internet" | "phone",
  "account_number": "12345678",
  "amount": 150000,
  "customer_id": "uuid"  // optional
}

Response 200:
{
  "transaction_id": "uuid",
  "status": "pending" | "success" | "failed",
  "provider_ref": "click-ref-123"
}
```

## Acceptance criteria
- Mavjud Click credentials (`app_settings.online_payments.click`) ishlatiladi.
- Click enabled bo'lmasa 400 qaytaradi.
- `payment_transactions` jadvalga yoziladi (mavjud `find_or_create_transaction` ishlatiladi).
- `organization_id` filter.
- `finance.bill_payment` — cashier + accountant + admin.
- Sandbox mode: real Click API'ga ulanish (mavjud Click sandbox credentials bilan test).

## How we'll know it's done
Click enabled org'da `POST /finance/bill-payment` 200 qaytaradi va `payment_transactions`'da yozuv paydo bo'ladi.
