# EC-1 — B2B portal: katalogni kategoriya/rasm/stock bilan boyitish

**Spec**: `tickets/SPEC-ecommerce-b2b.md`

## Goal

`GET /customer-portal/products` (hozir faqat `id, sku, name, sale_price` qaytaradi) ni kategoriya,
rasm va real-time stock holati bilan kengaytirish — shu endpoint hali to'liq mijoz-katalogiga aylanishi uchun.

## Files likely touched

- `apps/api/app/modules/customer_portal/router.py` — `list_products_for_customer()` funksiyasi
- `apps/api/app/modules/warehouse/service.py` — `get_products_paginated()` — stock-aware SELECT naqshini qayta ishlatish uchun namuna/qisman qayta ishlatiladigan helper
- (ehtimol) `apps/api/app/modules/customer_portal/service.py` — yangi fayl, agar logika router.py'dan ajratilsa

## How we'll know it's done

- `GET /customer-portal/products` javobida har bir mahsulot uchun `category_id`, `category_name`, `image_url`, va stock holati (masalan `stock_qty` + `in_stock: bool`) bor
- `category_id` query parametri bilan filtrlash ishlaydi (hozir yo'q)
- Org A mijozi Org B mahsulotini ko'ra olmaydi (mavjud testdagi kabi — manual tekshirish yetarli, pytest yo'q bu repoda)
- Arxivlangan (`is_archived=TRUE`) mahsulotlar ro'yxatda chiqmaydi

## Owner role

`backend-dev`

## Depends on

none
