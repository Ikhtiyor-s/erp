# EC-2 — B2B: segment/shartnoma narx-override modelini loyihalash

**Spec**: `tickets/SPEC-ecommerce-b2b.md`

## Goal

Hozir narx-ro'yxat/segment-narx jadvali umuman yo'q — `customers.category_id` (segmentatsiya) bor,
lekin unga bog'langan narx yo'q; `contracts` jadvali esa faqat hujjat metadata (doc_number, sanalar),
item-darajasida narx override emas. Shu loyihani minimal shaklda loyihalash: qaysi jadval(lar) kerak,
narx qanday hisoblanadi (ustunlik tartibi: mijoz-maxsus > segment > standart `sale_price`).

## Files likely touched

- Yangi: `tickets/DESIGN-ecommerce-b2b-pricing.md` (architect tomonidan, `specs/templates/DESIGN.template.md` asosida)
- `apps/api/app/db/schema_patches.py` — yangi jadval/ustun uchun ALTER/CREATE patch (DESIGN tasdiqlangandan keyin, EC-3 bosqichida)

## How we'll know it's done

- DESIGN.md javob beradi: (a) yangi jadval sxemasi (masalan `customer_product_prices` va/yoki `customer_category_discounts`), (b) narx hisoblash funksiyasi signaturasi (qaysi modulga tegishli bo'ladi — `customer`, `sale` yoki `customer_portal`), (c) mavjud `contracts` jadvali bilan munosabat (kengaytiriladi yoki alohida qoladi — aniq qaror)
- EC-3 ticketi bu qarorga asoslanib implement qila oladi — qo'shimcha "qayta loyihalash" kerak bo'lmasligi kerak

## Owner role

`architect`

## Depends on

none
