# T-1 — mxik-backend-column

## Goal

`products` jadvalga `mxik VARCHAR(20) NULL` ustunini qo'shish va Pydantic schema'ga
10–17 raqam format validatori bilan `mxik` field kiritish.

## Acceptance criteria

- `schema_patches.py` PATCHES listida `ALTER TABLE products ADD COLUMN IF NOT EXISTS mxik
  VARCHAR(20)` SQL patch mavjud (idempotent — ikki marta yugursa xato bermaydi)
- `docker compose restart api` dan keyin `GET /api/v1/warehouse/products` response'da
  `"mxik": null` field ko'rinadi (mavjud mahsulotlar uchun)
- `ProductCreate` va `ProductUpdate` Pydantic modellarida `mxik: str | None = None` field bor
- `ProductOut` (response model) da `mxik: str | None` field bor
- `mxik = "0902103000"` (10 raqam) bilan `POST /products` — 201 qaytadi
- `mxik = "12345678901234567"` (17 raqam) bilan `POST /products` — 201 qaytadi
- `mxik = "123"` (3 raqam) bilan `POST /products` — 422 qaytadi
- `mxik = "123456789012345678"` (18 raqam) bilan `POST /products` — 422 qaytadi
- `mxik = "ABC1234567"` (harf bor) bilan `POST /products` — 422 qaytadi
- `mxik = null` bilan `POST /products` — 201 qaytadi (nullable)
- Validator xabari o'zbek tilidagi ma'no beradi yoki inglizcha aniq bo'ladi
- `mxik` audit middleware `SENSITIVE_KEYS` ro'yxatiga kiritilmagan (ommaviy ma'lumotnoma kodi)

## Files likely touched

- `apps/api/app/db/schema_patches.py`
- `apps/api/app/modules/warehouse/schemas.py`
- `apps/api/app/modules/warehouse/router.py` (minimal — faqat DB mapping tekshiruvi)

## Owner role

`backend-dev`

## Depends on

`none`

## Estimated effort

S (1–2 soat)
