# SPEC — Ecommerce: Public B2C Online Storefront (2026-10-12)

> PM tomonidan yoziladi. Bu **PROPOSE** bosqichi.
> Diqqat: bu spec katta "ecommerce" talabining B2C (anonim ommaviy do'kon) yarmi. B2B portal kengaytirish
> uchun alohida `tickets/SPEC-ecommerce-b2b.md` yozilgan — ikkisi ataylab ajratilgan (sabab: pastda, va PM
> javobida). Ticket fayllari umumiy raqamlanishda: B2B → `EC-1`..`EC-4`. Bu SPEC → `EC-5`..`EC-9`.
>
> Bu spec `EC-5`/`EC-6` orqali B2B spec'dagi `EC-1`/`EC-3` bilan BIR XIL asosiy naqshlarni (stock-aware
> katalog, `sales`+accounting handoff) qayta ishlatadi — lekin alohida, anonim-ga ochiq endpoint guruhi
> sifatida, chunki auth modeli butunlay boshqa (OTP bilan tanilgan mijoz emas, umuman login yo'q).

## Niyat (1 abzats)

Aniq ERP'da hozircha hech qanday ommaviy (anonim) onlayn do'kon yo'q — faqat ichki xodimlar
(`/warehouse/*`) yoki mavjud OTP-mijozlar (`customer_portal`) tizimga kira oladi. Hali mijoz bo'lmagan
tasodifiy xaridor uchun ochiq mahsulot katalogi, savatcha, checkout va real to'lov yig'ish kerak —
Odoo Website/eCommerce va MoySklad Retail darajasida: kategoriya+rasm+stock-aware mavjudlik, va checkout
natijasi haqiqiy `sale`ga aylanib, `warehouse` ombordan chiqishi va `accounting`ga yozilishi kerak. To'lov
tomonida hozircha faqat sozlama-placeholder bor (`integration/payments/` — Click/Payme/Apelsin, real
credential yo'q, `ROADMAP.md` "Tashqi credentials KUTILMOQDA"), shuning uchun checkout shu surfacega
qarshi ishlashi, credential kelmaguncha ham ("to'lov kutilmoqda"/naqd-yetkazishda-to'lov rejimida)
muvaffaqiyatli tugashi kerak.

## Tegishli foydalanuvchi

- **Asosiy**: `mehmon` (anonim xaridor — hech qanday login yo'q, faqat checkoutda ism+telefon beradi)
- **Ikkinchi darajali**: `manager`/`kassir` — tasdiqlanmagan ("to'lov kutilmoqda") onlayn buyurtmalarni ko'radi va qo'lda tasdiqlaydi/bekor qiladi

## Acceptance criteria (Given/When/Then)

**Scenario 1: Ommaviy katalog, autentifikatsiyasiz**
- **Given** faol, arxivlanmagan, "onlayn ko'rsatish"ga belgilangan mahsulot, stock>0
- **When** `GET /shop/products` (yangi PUBLIC endpoint) `Authorization` header'siz chaqiriladi
- **Then** 200, `id, name, category, image_url`, chakana narx, va stock-aware mavjudlik (`in_stock`/`out_of_stock`) qaytadi — `purchase_price`, `avg_cost` yoki boshqa ichki moliyaviy maydon HECH QACHON qaytmaydi

**Scenario 2: Checkout — mehmon mijoz + haqiqiy sotuv**
- **Given** savatda yetarli stock'ga ega qatorlar + mehmon kontakt (ism+telefon)
- **When** `POST /shop/checkout`
- **Then** (a) telefon bo'yicha mavjud `customers` yozuvi topiladi yoki yangi mehmon-mijoz yaratiladi, (b) `/sale/sales` bilan BIR XIL asosiy logika orqali (stock deduct + accounting posting) `sales`+`sale_items` yaratiladi, (c) javobda buyurtma tasdiqi + to'lov yo'li qaytadi

**Scenario 3: To'lov — stub/qo'lda tasdiqlash rejimi (bugungi haqiqiy holat)**
- **Given** tashkilotda hech qaysi provider `online_payments.<provider>.enabled=true` emas (bugungi real holat, `ROADMAP.md`ga qarang)
- **When** checkout tugaydi
- **Then** sotuv "to'lov kutilmoqda" holatida (`paid_amount=0`) yaratiladi, xaridorga "Naqd/yetkazib berishda to'lov" yoki "Operator tasdiqlaydi" xabari ko'rsatiladi — checkout QATTIQ MUVAFFAQIYATSIZ tugamaydi

**Scenario 4: To'lov — pluggable gateway rejimi (credential kelganda)**
- **Given** tashkilotda `online_payments.click.enabled=true` haqiqiy `merchant_id`/`secret_key` bilan
- **When** checkout tugaydi
- **Then** yangi `sale.id`ga bog'langan `payment_transactions` yozuvi yaratiladi va mavjud `click.py` ikki-bosqichli webhook (`handle_click_webhook`) O'ZGARTIRILMAGAN holda ishlaydi — storefrontda provayderga xos kod TAKRORLANMAYDI

**Scenario 5: Stock race / ortiqcha sotish himoyasi**
- **Given** bir mahsulotning oxirgi birligi uchun ikki checkout deyarli bir vaqtda keladi
- **When** ikkisi ham `POST /shop/checkout` yuboradi
- **Then** faqat bittasi muvaffaqiyatli bo'ladi (mavjud `_stock_apply` lock/negative-balance himoyasidan foydalaniladi), ikkinchisi 409/422 "qoldiq tugadi" oladi

**Scenario 6: Ko'p-tashkilotli izolyatsiya**
- **Given** do'kon `org_code` (customer_portal OTP'dagi naqshga mos) orqali tashkilotga bog'langan
- **When** so'rov Org B kontekstida Org A mahsulot id'siga murojaat qiladi
- **Then** 404, hech qanday ma'lumot sizib chiqmaydi

## Talablar (RFC 2119)

- **MUST**: Yangi PUBLIC (auth'siz) endpoint guruhi yaratilishi shart, mavjud ichki `/warehouse/products` dan ALOHIDA — faqat `is_active=TRUE`, `is_archived=FALSE`, va yangi "onlayn ko'rsatish" belgisiga ega mahsulotlar qaytarilsin
- **MUST**: Public endpoint `purchase_price`, `avg_cost` yoki boshqa ichki moliyaviy/operatsion maydonni hech qachon qaytarmasligi shart
- **MUST**: Checkout haqiqiy `sales`+`sale_items` yozuvini yaratishi, ombordan mavjud `_stock_apply` orqali kamaytirishi va `post_journal_entry` orqali moliyaga yozilishi shart
- **MUST**: To'lov integratsiyasi FAQAT mavjud `integration/payments/base.py` + provider fayllaridan (`click.py`/`payme.py`/...) foydalanishi shart — storefront checkout ichida yangi to'lov protokoli yozilmaydi
- **MUST**: Agar hech qaysi provider "enabled" bo'lmasa, checkout baribir muvaffaqiyatli tugashi va buyurtma "to'lov kutilmoqda" holatida yaratilishi shart (graceful degrade, hard-fail yo'q)
- **MUST NOT**: Checkout mehmon xaridorning shaxsiy ma'lumotini (telefon, ism) boshqa tashkilotga yoki boshqa xaridorga ko'rsatmasligi/sizdirmasligi shart
- **SHOULD**: Ombor avtomatik tanlansin — sozlamada belgilangan "onlayn savdo ombori" ishlatilsin, xaridorga ombor tanlash ko'rsatilmasin
- **SHOULD**: Katalog va checkout endpointlariga rate-limiting qo'yilsin (mavjud `app.core.rate_limit.limiter`, OTP endpointidagi namuna bo'yicha)
- **MAY**: Kelajakda real-time kuryer/yetkazib berish integratsiyasi (Yandex Delivery va h.k.) — bu safar emas

## QILMAYMIZ (qamrov-tashqarisida)

- Uzum Market yoki boshqa marketplace integratsiyasi — alohida, allaqachon kuzatilgan gap, bu ticket to'plamiga kirmaydi
- Real Click/Payme/Apelsin'ni "live" ishga tushirish (haqiqiy merchant credential bilan sinov) — credential yo'q; faqat PLUGGABLE surface tayyorlanadi
- Promo-kod/chegirma kuponlari, savat tashlab ketish (abandoned cart) email/SMS marketing — keyingi sprint
- Ko'p valyutali checkout — hozir mavjud sotuv valyuta modeliga (`currency_id`) mos, bitta asosiy valyuta
- Mobil ilova shop — faqat web (Next.js) responsive sahifa
- SEO/marketing landing/blog sahifalari — faqat katalog+checkout funksional qismi
- Real-vaqt kuryer/yetkazib berish kuzatuvi — alohida, allaqachon ROADMAP'da P2/P3

## Rollback rejasi

- **Code**: yangi public router butunlay alohida prefix (`/shop`) ostida, alohida modulda — o'chirish = router'ni app'dan unregister qilish; mavjud hech bir ichki/portal endpoint o'zgarmaydi
- **DB**: `products.is_published_online` (yoki teng) — nullable/default FALSE, xavfsiz drop
- **DB**: checkoutda yaratilgan `sales`/`sale_items`/`payment_transactions` — moliyaviy yozuv, o'chirilmaydi; rollback faqat YANGI checkout yo'lini to'xtatadi, mavjud yozuvlarga tegmaydi
- **User-facing**: do'kon sahifasi (`/shop`) butunlay yangi route — o'chirilsa foydalanuvchiga "vaqtincha yopiq" holati ko'rsatiladi, boshqa hech narsa buzilmaydi

## Tegishli modullar

- `apps/api/app/modules/warehouse/router.py`, `apps/api/app/modules/warehouse/service.py` — mahsulot/kategoriya/stock manbasi (`get_products_paginated`, `_stock_apply`)
- `apps/api/app/modules/sale/router.py` — `POST /sale/sales` (`create_sale`) — stock+accounting handoff logikasining HAQIQIY manbasi, checkout shuni qayta ishlatishi kerak (`sale/service.py` ajratib olinishi mumkin — hozir yo'q)
- `apps/api/app/modules/accounting/posting.py` — `post_journal_entry`, `DEFAULT_ACCOUNT_CODES`
- `apps/api/app/modules/integration/payments/base.py` — `get_payment_settings`, `find_or_create_transaction`, `mark_transaction`, `apply_payment_to_sale` (`sale_id` bog'langan, `order_id` emas — checkout buni hisobga olishi kerak)
- `apps/api/app/modules/integration/payments/click.py` (va `payme.py`, `alif.py`, `multicard.py`, `rahmat.py`, `uzum.py`) — mavjud ikki-bosqichli webhook protokoli, `sales.id`ga bog'langan
- `apps/api/app/modules/customer/router.py` — `customers`, `customer_categories` (mehmon-mijoz yaratish/topish shu jadvalga yozadi)
- `apps/api/app/modules/customer_portal/auth.py` — OTP/JWT naqshi (`org_code` bilan tashkilot aniqlash) — do'kon qaysi tashkilotga tegishli ekanligini aniqlashda xuddi shu naqsh qayta ishlatiladi
- **Yangi**: `apps/api/app/modules/storefront/` (taklif qilingan yangi modul nomi — yakuniy nom architect DESIGN'da) — public router + checkout
- **Yangi**: `apps/web/app/(shop)/...` — public Next.js route group (katalog, savat, checkout, buyurtma tasdiqi)

## O'zbek bozori xosligi

- **OFD**: ✗ bevosita tegmaydi bu sprintda — checkout sotuvi mavjud chek/hisob-faktura PDF oqimidan (`sale/pdf.py`) foydalanadi, o'zgarishsiz
- **MXIK**: ✗ tegmaydi (mahsulotlarda allaqachon bor)
- **QQS**: ✗ tegmaydi bu sprintda
- **TIN/STIR**: ✗ tegmaydi
- **SMS (Eskiz)**: ✓ ixtiyoriy — buyurtma tasdiqlash SMS, mavjud Eskiz infratuzilmasi qayta ishlatiladi (yangi provider yozilmaydi)
- **To'lov**: ✓ asosiy mavzu — Click/Payme/Apelsin pluggable surface, hozircha stub/qo'lda tasdiqlash

## Effort estimation

- Backend (EC-5, EC-6, EC-7): XL — ~4-6 kun (yangi public modul + sale-handoff refaktoring + to'lov ulash)
- Architect (EC-9): M — ~1 kun (DESIGN.md)
- Frontend (EC-8): L — ~3-4 kun (yangi route group, savat state, checkout UI)
- Total: ~8-11 kun

## Tickets

- `EC-5-b2c-public-catalog-api.md` — backend-dev
- `EC-6-b2c-checkout-sale-handoff.md` — backend-dev (depends: EC-5, EC-9)
- `EC-7-b2c-payment-surface-wiring.md` — backend-dev (depends: EC-6)
- `EC-8-b2c-storefront-frontend.md` — frontend-dev (depends: EC-5, EC-6, EC-7)
- `EC-9-b2c-storefront-design.md` — architect (depends: none; parallel to EC-5)
