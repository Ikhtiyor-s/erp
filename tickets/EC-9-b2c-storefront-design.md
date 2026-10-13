# EC-9 — B2C storefront: modul chegarasi va handoff arxitekturasi

**Spec**: `tickets/SPEC-ecommerce-b2c.md`

## Goal

`EC-6`/`EC-7` implementatsiyasidan oldin hal qilinishi kerak bo'lgan arxitektura qarorlarini yozish:
(1) yangi public modul qayerda yashaydi va nima nomlanadi (`storefront` vs `customer_portal`ga qo'shish —
tavsiya: ALOHIDA modul, chunki auth modeli butunlay boshqa), (2) `sale/router.py`dagi `create_sale()`
yadro logikasi qanday qilib `sale/service.py`ga chiqariladi-da ham ichki `/sale/sales`, ham B2B
(`EC-3`), ham B2C (`EC-6`) buni duplikatsiz chaqira oladi, (3) mehmon-mijoz dedup strategiyasi (faqat
telefon bo'yicha? +ism?), (4) stock-race himoyasi checkout ostida qanday ishlaydi (mavjud `_stock_apply`
locking yetarli-mi yoki qo'shimcha reservation qatlami kerak-mi), (5) `products.is_published_online`
migratsiyasi va mavjud `/warehouse/products` admin UI'ga qanday integratsiya qilinadi (yangi checkbox).

## Files likely touched

- Yangi: `tickets/DESIGN-ecommerce-b2c.md` (`specs/templates/DESIGN.template.md` asosida)

## How we'll know it's done

- DESIGN.md javob beradi: yangi modul nomi+joylashuvi, `sale/service.py` signaturasi (kim nima uzatadi:
  org_id, customer_id|None, warehouse_id, items, va kim committing qiladi), guest-customer dedup qoidasi,
  race-condition himoya yondashuvi, `is_published_online` migratsiya rejasi
- `EC-6` va `EC-7` ishni shu qarorlarga asoslanib boshlay oladi — implementatsiya davomida qayta
  loyihalash kerak bo'lmaydi

## Owner role

`architect`

## Depends on

none
