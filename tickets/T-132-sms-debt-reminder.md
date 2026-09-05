# T-132: Backend — SMS qarz eslatmasi endpoint

**Wave:** 4D
**Owner:** backend-dev
**Size:** S
**Depends on:** T-131 (UI chaqiradi; mavjud sms/eskiz.py ishlatiladi)

## Goal
`POST /finance/debtors/{customer_id}/send-sms` — qarz haqida SMS reminder yuborish (Eskiz orqali).

## Files likely touched
- `apps/api/app/modules/finance/router.py` (yangi endpoint)
- `apps/api/app/modules/integration/sms/eskiz.py` (mavjud — ishlatiladi)
- `apps/api/app/modules/rbac/permissions.py` (`finance.send_sms`)

## Request/Response
```
POST /finance/debtors/{customer_id}/send-sms
Body: { "message_template": "default" | "custom", "custom_text": "..." }

Response 200:
{ "sent": true, "phone": "+998901234567", "message_id": "eskiz-ref" }
```

## SMS template (default)
```
Hurmatli {ism}, sizning qarzdorligingiz: {summa} so'm.
Iltimos, to'lovni amalga oshiring.
Aniq ERP
```

## Acceptance criteria
- Mijoz telefon raqami `customers` jadvalidan olinadi.
- Eskiz enabled bo'lmasa 400 (`sms_not_configured`).
- Mijoz telefon raqami yo'q bo'lsa 400 (`phone_missing`).
- SMS yuborish muvaffaqiyatli bo'lsa `customer_notes` yoki audit log'ga yoziladi.
- `organization_id` filter.
- `finance.send_sms` — manager + admin.
- Qarz summasi real-time DB'dan olinadi (T-131 UI'dagi qiymat ishonilmaydi).

## How we'll know it's done
Eskiz sozlangan org'da `POST /finance/debtors/{id}/send-sms` chaqirilsa 200 + Eskiz'dan xabar jo'natiladi (sandbox).
