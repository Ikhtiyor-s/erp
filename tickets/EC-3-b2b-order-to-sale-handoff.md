# EC-3 — B2B: `/me/orders`ni haqiqiy `sales` yozuviga aylantirish

**Spec**: `tickets/SPEC-ecommerce-b2b.md`

## Goal

`POST /customer-portal/me/orders` hozir faqat `customer_portal_orders`/`customer_portal_order_items`ga
yozadi — stock tekshirmaydi, accounting'ga tegmaydi. Buni `POST /sale/sales` (`create_sale`)dagi HAQIQIY
stock-deduct + accounting-posting logikasi bilan bog'lash — ikki marta yozilmasin, ikkalasi ham bir xil
yadro logikasidan foydalansin.

## Files likely touched

- `apps/api/app/modules/sale/router.py` — `create_sale()` ichidagi logikani qayta ishlatiladigan funksiyaga chiqarish (yangi `apps/api/app/modules/sale/service.py` kerak bo'lishi mumkin — hozir bu modulda `service.py` yo'q)
- `apps/api/app/modules/customer_portal/router.py` — `create_order()` — endi shu umumiy funksiyani chaqiradi, so'ng `customer_portal_orders` ga faqat metadata/`sale_id` FK yozadi
- `apps/api/app/db/schema_patches.py` — `customer_portal_orders.sale_id` yangi ustun (nullable FK → `sales.id`)
- EC-2'da aniqlangan narx-override jadvali/funksiyasi — buyurtma summasini hisoblashda ishlatiladi

## How we'll know it's done

- `POST /customer-portal/me/orders` muvaffaqiyatli chaqirilganda: `sales`+`sale_items` yozuvi paydo bo'ladi, `stock_balances` kamayadi, `journal_entries`/`journal_lines`da yangi yozuv bor (AR/Revenue, + COGS/Inventory)
- Stock yetarli bo'lmagan qatorli buyurtma 422 bilan rad etiladi va HECH NARSA yozilmaydi (tranzaksiya atomik — bitta DB session/commit)
- `/customer-portal/me/sales` ro'yxatida yangi buyurtma oddiy sotuv sifatida ko'rinadi (chunki endi haqiqiy `sales` qatori)
- `apps/web/app/(dashboard)/customer/portal-orders/page.tsx` eski ko'rinishi buzilmaydi (backward-compatible — `sale_id` qo'shimcha maydon)

## Owner role

`backend-dev`

## Depends on

EC-1, EC-2
