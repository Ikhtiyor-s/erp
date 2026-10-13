# EC-6 — B2C: checkout → mehmon-mijoz + haqiqiy `sales` handoff

**Spec**: `tickets/SPEC-ecommerce-b2c.md`

## Goal

`POST /shop/checkout` endpointini yaratish: telefon bo'yicha mavjud `customers` yozuvini topadi yoki
yangi mehmon-mijoz yaratadi, so'ng `EC-3`da (B2B) chiqarilgan umumiy "sale yaratish" yadrosidan
foydalanib haqiqiy `sales`+`sale_items` yozadi (stock deduct + accounting posting), stock-race holatida
faqat bitta so'rov muvaffaqiyatli bo'lishini ta'minlaydi.

## Files likely touched

- `apps/api/app/modules/storefront/router.py` — `POST /shop/checkout`
- `apps/api/app/modules/sale/service.py` (EC-3'da yaratilgan umumiy funksiya) — bu yerdan qayta ishlatiladi, TAKRORLANMAYDI
- `apps/api/app/modules/customer/router.py` yoki yangi `apps/api/app/modules/customer/service.py` — "telefon bo'yicha top-yoki-yarat" guest-customer helper
- `apps/api/app/modules/warehouse/service.py` — `_stock_apply` (mavjud lock/negative-balance himoyasi qayta ishlatiladi, o'zgartirilmaydi)

## How we'll know it's done

- Checkout muvaffaqiyatli bo'lganda: yangi/topilgan `customers` yozuvi, yangi `sales`+`sale_items`, kamaygan `stock_balances`, yangi `journal_entries` bor
- Ikki parallel checkout (oxirgi birlik uchun) — faqat bittasi 201, ikkinchisi 409/422 "qoldiq tugadi" (manual load-test yoki ikki tezkor ketma-ket so'rov bilan tekshiriladi)
- Telefon raqami allaqachon mavjud mijozga tegishli bo'lsa, YANGI dublikat `customers` yozuvi yaratilmaydi
- Checkout javobi `sale_id`, `order_number`, va to'lov holati (`payment_pending`/boshqa) qaytaradi — bu `EC-7` ustiga quriladi

## Owner role

`backend-dev`

## Depends on

EC-5, EC-9
