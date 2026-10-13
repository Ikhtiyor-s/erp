# EC-7 — B2C: to'lov surface ulash (stub/manual + pluggable gateway)

**Spec**: `tickets/SPEC-ecommerce-b2c.md`

## Goal

`EC-6`da yaratilgan `sale.id`ni mavjud `integration/payments/base.py` + provider fayllariga (`click.py`
va h.k.) bog'lash: agar org'da hech qaysi provider "enabled" bo'lmasa (bugungi real holat), checkout
"to'lov kutilmoqda" holatida muvaffaqiyatli yakunlanadi; agar provider yoqilgan bo'lsa, mavjud
`find_or_create_transaction`/webhook oqimi ishlatiladi — storefrontda yangi to'lov protokoli yozilmaydi.

## Files likely touched

- `apps/api/app/modules/storefront/router.py` — checkout javobiga to'lov bo'limi qo'shish (`get_payment_settings` chaqiriladi, provider yoqilgan/yo'qligiga qarab branch)
- `apps/api/app/modules/integration/payments/base.py` — `find_or_create_transaction()` chaqiruvi (mavjud, o'zgarishsiz qayta ishlatiladi)
- `apps/api/app/modules/integration/payments/click.py` / `payme.py` — O'ZGARTIRILMAYDI (webhook allaqachon `sales.id`ga ishlaydi); faqat checkout shu `sale.id`ni to'g'ri uzatishini tekshirish

## How we'll know it's done

- Provider yoqilmagan org'da checkout 201 bilan tugaydi, javobda `payment_status: "pending_manual"` (yoki shunga mos) va foydalanuvchiga ko'rsatiladigan xabar bor
- Provider (masalan Click, test/sandbox sozlamalari bilan — real production credential shart emas) yoqilgan org'da checkout javobida to'lov linki/`payment_transactions.id` bor, va mavjud Click webhook (`action=0`/`action=1`) shu `sale_id` bilan to'g'ri ishlaydi (mavjud `apply_payment_to_sale` orqali `paid_amount` yangilanadi)
- Hech qanday provider-maxsus kod `storefront` modulida yozilmagan (faqat `base.py`/provider fayllarini chaqiradi)

## Owner role

`backend-dev`

## Depends on

EC-6
