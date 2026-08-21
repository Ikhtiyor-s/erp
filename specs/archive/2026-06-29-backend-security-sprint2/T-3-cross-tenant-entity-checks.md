# T-3 — cross-tenant-entity-checks

## Goal

Uchta HIGH zaiflikni yopish: (HI-1) `create_sale` da `warehouse_id` va barcha
`sale_items.product_id`'larni caller org'ga tegishliligini tekshirish; (HI-2)
`create_movement` da `cashbox_id` org tekshiruvi; (HI-3) `pay_sale` da cashbox org
tekshiruvi va `sale UPDATE + cash_movements INSERT` bitta atomik DB tranzaksiyasiga olish.

## Acceptance criteria

### HI-1: create_sale

- `POST /api/v1/sale/orders` — `warehouse_id` Org B'ga tegishli bo'lsa → 422, xato: `"warehouse_id does not belong to your organization"`
- `POST /api/v1/sale/orders` — `sale_items` ichida birorta `product_id` Org B'ga tegishli bo'lsa → 422, xato qaysi `product_id` noto'g'ri ekanini ko'rsatadi
- Tekshirish bitta SQL'da amalga oshiriladi — `WHERE id = :wid AND organization_id = :o` shaklida (alohida SELECT + Python assert emas)
- O'z org entity'lari bilan so'rov muvaffaqiyatli — 201

### HI-2: create_movement

- `POST /api/v1/finance/movements` — `cashbox_id` boshqa org'ga tegishli bo'lsa → 422, xato: `"cashbox_id does not belong to your organization"`
- O'z org cashbox bilan — 201
- Tekshirish `WHERE id = :cb AND organization_id = :o` SQL paternida

### HI-3: pay_sale

- `POST /api/v1/sale/orders/{id}/pay` — `cashbox_id` boshqa org'ga tegishli bo'lsa → 422, hech qanday DB o'zgarish yo'q
- `pay_sale` handler ichida `sale.status = 'paid'` UPDATE va `cash_movements` INSERT bitta `async with db.begin()` yoki mavjud session transaction ichida amalga oshiriladi
- `cash_movements INSERT` xato bo'lsa `sale.status` avvalgi holatda qoladi (rollback ishlaydi)
- Barcha uch endpoint o'z org entity'lari bilan muvaffaqiyatli ishlaydi — 200/201
- Mavjud barcha testlar PASS

## Files likely touched

- `apps/api/app/modules/sale/router.py` (satırlar 106-131 va 370-388)
- `apps/api/app/modules/finance/router.py` (satırlar 181-217)

## Owner role

`backend-dev`

## Depends on

`none`

## Estimated effort

M (2-3 soat)
