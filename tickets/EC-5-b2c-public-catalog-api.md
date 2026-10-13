# EC-5 — B2C: anonim (public) katalog API

**Spec**: `tickets/SPEC-ecommerce-b2c.md`

## Goal

Hech qanday autentifikatsiya talab qilmaydigan yangi public endpoint guruhini yaratish — faol,
arxivlanmagan va "onlayn ko'rsatish"ga belgilangan mahsulotlarni kategoriya/rasm/stock-aware mavjudlik
bilan qaytaradi, ichki moliyaviy maydonlarsiz (`purchase_price`, `avg_cost` va h.k. hech qachon chiqmaydi).

## Files likely touched

- Yangi modul: `apps/api/app/modules/storefront/router.py` (yakuniy modul nomi `EC-9` DESIGN'da tasdiqlanadi) — `GET /shop/products`, `GET /shop/products/{id}`, `GET /shop/categories`
- `apps/api/app/db/schema_patches.py` — `products.is_published_online BOOLEAN DEFAULT FALSE` yangi ustun
- `apps/api/app/modules/warehouse/router.py` yoki yangi admin UI joyi — xodim mahsulotni "onlayn ko'rsatish"ga belgilashi uchun (kichik PATCH endpoint, mavjud `patch_product` naqshiga mos)
- `apps/api/app/main.py` (yoki router registratsiya joyi) — yangi public router ulash, lekin hech qanday auth dependency QO'SHMASLIK uchun ehtiyot bo'lish (boshqa routerlardan ALOHIDA, auth middleware'ga tushib qolmasligi tekshiriladi)

## How we'll know it's done

- `curl` (hech qanday `Authorization` header'siz) `GET /shop/products?org=<code>` 200 qaytaradi, javobda `purchase_price`/`avg_cost` yo'q
- `is_published_online=FALSE` yoki `is_archived=TRUE` mahsulot ro'yxatda chiqmaydi
- Stock=0 mahsulot `in_stock: false` bilan qaytadi (ro'yxatdan umuman yo'qolmaydi — "tugagan" sifatida ko'rsatiladi)
- Org A so'rovi Org B mahsulotini qaytarmaydi

## Owner role

`backend-dev`

## Depends on

none
