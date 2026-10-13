# SPEC — Ecommerce: B2B Portal Expansion (2026-10-12)

> PM tomonidan yoziladi. Bu **PROPOSE** bosqichi.
> Diqqat: bu spec katta "ecommerce" talabining B2B yarmi. B2C (anonim ommaviy do'kon) uchun alohida
> `tickets/SPEC-ecommerce-b2c.md` yozilgan — ikkisi ataylab ajratilgan (sabab: pastda, va PM javobida).
> Ticket fayllari umumiy raqamlanishda: bu SPEC → `EC-1`..`EC-4`. B2C → `EC-5`..`EC-9`.

## Niyat (1 abzats)

`apps/api/app/modules/customer_portal/` allaqachon mavjud: OTP login (`/auth/request-otp`, `/auth/verify`),
profil/balans (`/me`, `/me/balance`), sotuv tarixi (`/me/sales`), va bitta yarim-tayyor buyurtma endpointi
(`POST /me/orders`). Lekin bu buyurtma endpointi — ko'rinma: `customer_portal_orders`/`customer_portal_order_items`
jadvallariga yozadi, stock'ni tekshirmaydi, har doim `products.sale_price`dan (segment/shartnoma narxisiz)
hisoblaydi, va HECH QACHON haqiqiy `sales` yozuviga, ombordan chiqimga yoki buxgalteriya (`post_journal_entry`)
yozuviga aylanmaydi. Mavjud B2B mijoz (do'kon/restoran egasi, ulgurji xaridor va h.k.) o'z shartnoma narxida,
mavjud balans/kredit shartlarida haqiqiy buyurtma bera olishi, va bu buyurtma oddiy sotuv kabi ombor+moliyada
aks etishi kerak — aks holda bu funksiya "ko'rsatma qutisi"dan nariga o'tmaydi.

## Tegishli foydalanuvchi

- **Asosiy**: `mijoz` — mavjud B2B mijoz, telefon+OTP orqali `customer_portal`ga kirgan
- **Ikkinchi darajali**: `manager`/`sotuvchi` — `/customer/portal-orders` sahifasida portal buyurtmalarini kuzatadi (mavjud sahifa, endi haqiqiy `sales` bilan bog'langan holda)

## Acceptance criteria (Given/When/Then)

**Scenario 1: Kategoriya/rasm/stock bilan katalog**
- **Given** OTP bilan tasdiqlangan mijoz, tashkilotda `product_categories` va `stock_balances`ga ega mahsulotlar bor
- **When** `GET /customer-portal/products?category_id=X`
- **Then** 200, har bir mahsulotda `category_name`, `image_url`, va stock holati (`in_stock`/`low`/`out_of_stock`) qaytadi — hozirgi kabi faqat `id, sku, name, sale_price` emas

**Scenario 2: Segment/shartnoma narxi qo'llanadi**
- **Given** mijoz `customer_categories`dagi bir kategoriyaga tegishli (yoki unga alohida narx override belgilangan)
- **When** `GET /customer-portal/products` yoki buyurtma yaratilayotganda narx hisoblanadi
- **Then** qaytgan narx override'ni aks ettiradi, aks holda standart `products.sale_price`ga tushadi

**Scenario 3: Buyurtma = haqiqiy sotuv**
- **Given** autentifikatsiyadan o'tgan mijoz, barcha qatorlarda "onlayn savdo ombori"da yetarli stock bor
- **When** `POST /customer-portal/me/orders`
- **Then** yangi `sales`+`sale_items` yozuvi yaratiladi (mavjud `_stock_apply` orqali stock kamayadi, `post_journal_entry` orqali AR/Revenue/COGS/Inventory yoziladi), javobda `order_number` + `sale_id` qaytadi

**Scenario 4: Stock yetarli bo'lmasa — atomik rad**
- **Given** qatorlardan birida so'ralgan miqdor mavjud stock'dan ko'p
- **When** `POST /customer-portal/me/orders`
- **Then** 422, hech qanday `sales`/`sale_items`/stock yozilmaydi (hammasi yoki hech narsa)

**Scenario 5: Kredit/balans orqali to'lovsiz buyurtma**
- **Given** mijozning mavjud qarzi/balansi (`/me/balance`) bor
- **When** ular onlayn to'lovsiz buyurtma yuboradi
- **Then** sotuv `paid_amount=0` bilan yaratiladi (mavjud sale status modeliga mos), va yangi qarz `/me/balance`da darhol ko'rinadi

**Scenario 6: Cross-tenant izolyatsiya**
- **Given** Org A mijozi
- **When** Org B'ning mahsulotini ko'rish/buyurtma qilishga urinadi
- **Then** 404, hech qanday ma'lumot sizib chiqmaydi (mavjud `organization_id` filter patterniga mos)

## Talablar (RFC 2119)

- **MUST**: `/customer-portal/products` kategoriya, rasm va real-time stock holatini mavjud `product_categories`/`stock_balances` jadvallaridan qaytarishi shart
- **MUST**: Har bir mijoz uchun qaytgan narx uning segment/shartnoma override'ini hisobga olishi shart (mavjud bo'lsa), aks holda `products.sale_price`
- **MUST**: `POST /customer-portal/me/orders` haqiqiy `sales`+`sale_items` yozuvini yaratishi, stock'ni mavjud `_stock_apply` orqali kamaytirishi va `post_journal_entry` orqali buxgalteriya yozuvini hosil qilishi shart
- **MUST**: Mavjud `customer_portal_orders`/`customer_portal_order_items` jadvallari endi faqat metadata/tarix sifatida saqlanishi mumkin, lekin ularga `sale_id` FK qo'shilishi va haqiqiy manba `sales` bo'lishi shart
- **MUST NOT**: Boshqa tashkilotning mahsuloti, narxi yoki buyurtmasi ko'rsatilmasligi shart
- **SHOULD**: Agar buyurtma summasi mijozning belgilangan kredit limitidan oshsa, tizim ogohlantirish qaytarsin (hard-block emas — MVP uchun yumshoq tekshiruv)
- **MAY**: Kelajakda manager tomonidan "buyurtmani tasdiqlash" oraliq bosqichi (draft→confirmed) qo'shilishi mumkin — bu sprintda emas

## QILMAYMIZ (qamrov-tashqarisida)

- Narx-ro'yxat (price list) uchun to'liq admin boshqaruv UI — faqat backendda minimal segment/shartnoma override mexanizmi; to'liq CRUD panel keyingi sprint
- Onlayn to'lov (Click/Payme/Apelsin) B2B portalda — B2B mijoz mavjud kredit/balans orqali xarid qiladi, to'lov gateway bu bosqichda shart emas (buni B2C qamraydi)
- Buyurtma tasdiqlash workflow (manager approval bosqichi) — MVP'da submit = darhol `sales`
- B2B portal uchun alohida mobil ilova/PWA — faqat mavjud `(portal)` web route group kengaytiriladi
- Mijozga ombor tanlash imkoniyati — bitta "onlayn savdo ombori" sozlamada belgilanadi, mijoz tanlamaydi
- Uzum Market yoki boshqa marketplace integratsiyasi — alohida, allaqachon kuzatilgan gap

## Rollback rejasi

- **Code**: `/customer-portal/me/orders` yangi implementatsiyasi alohida commit/PR — xато chiqsa eski (customer_portal_orders-only) versiyaga revert qilinadi; `sales` jadvali faqat qo'shiladi, o'chirilmaydi, shuning uchun revert xavfsiz
- **DB**: `customer_portal_orders.sale_id` yangi ustun — nullable, drop qilish xavfsiz
- **DB**: narx-override uchun yangi jadval/ustun (aniq shakli — architect DESIGN'da) — nullable/qo'shimcha, mavjud narx hisobiga ta'sir qilmaydi agar bo'sh bo'lsa
- **User-facing**: agar frontend buzilsa, `(portal)/portal/products` sahifasi eski (narxsiz-override) ko'rinishga qaytariladi — backend o'zgarishi frontend'ni buzmaydi (backward-compatible response kengaytmasi)

## Tegishli modullar

- `apps/api/app/modules/customer_portal/router.py` — `/auth/*`, `/me`, `/me/balance`, `/me/sales*`, `/me/orders` (asosiy o'zgaradigan joy), `/products`
- `apps/api/app/modules/customer_portal/auth.py` — `get_current_customer`, customer JWT (`kind=customer`, alohida secret)
- `apps/api/app/modules/warehouse/router.py` — `/warehouse/products`, `/warehouse/categories`, `/warehouse/stock` (qayta ishlatiladigan naqshlar)
- `apps/api/app/modules/warehouse/service.py` — `_stock_qty`, `_stock_apply`, `get_products_paginated` (stock-aware list uchun namuna)
- `apps/api/app/modules/sale/router.py` — `POST /sale/sales` (`create_sale`) — stock deduct + accounting posting logikasining HAQIQIY manbasi; bu logika customer_portal buyurtmasi uchun qayta ishlatilishi/chiqarib olinishi kerak (`sale/service.py` hali yo'q — yangi fayl kerak bo'lishi mumkin)
- `apps/api/app/modules/accounting/posting.py` — `post_journal_entry`, `get_default_account_id`, `DEFAULT_ACCOUNT_CODES`
- `apps/api/app/modules/customer/router.py` — `customer_categories` (segmentatsiya), `customers.category_id`
- `apps/web/app/(portal)/portal/products/page.tsx`, `apps/web/app/(portal)/portal/dashboard/page.tsx`, `apps/web/app/(portal)/portal/sales/page.tsx` — mavjud portal frontend sahifalari
- `apps/web/app/(dashboard)/customer/portal-orders/page.tsx` — xodim tomondan portal buyurtmalarini ko'rish sahifasi (endi `sale_id` bilan bog'lanadi)

## O'zbek bozori xosligi

- **OFD**: ✗ bevosita tegmaydi — buyurtma oddiy `sales` bo'lgani uchun mavjud chek/hisob-faktura PDF oqimi (`sale/pdf.py`) o'zgarishsiz ishlaydi
- **MXIK**: ✗ tegmaydi (mahsulotlarda allaqachon bor)
- **QQS**: ✗ tegmaydi bu sprintda
- **TIN/STIR**: ✗ tegmaydi
- **SMS (Eskiz)**: ✗ OTP allaqachon ishlaydi, o'zgarmaydi
- **To'lov**: ✗ ataylab tegmaydi — B2B kredit/balans orqali ishlaydi, gateway kerak emas

## Effort estimation

- Backend (EC-1, EC-3): L (katalog kengaytirish + sale-handoff refaktoring) — ~2-3 kun
- Architect (EC-2): S-M — ~0.5-1 kun (DESIGN.md)
- Frontend (EC-4): M — ~1-2 kun
- Total: ~4-6 kun

## Tickets

- `EC-1-b2b-catalog-categories-images-stock.md` — backend-dev
- `EC-2-b2b-pricing-override-design.md` — architect
- `EC-3-b2b-order-to-sale-handoff.md` — backend-dev (depends: EC-1, EC-2)
- `EC-4-b2b-portal-frontend-cart-checkout.md` — frontend-dev (depends: EC-1, EC-3)
