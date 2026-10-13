# SPEC — Self-checkout kiosk rejimi (SelfPOS) (2026-10-12)

> PM/Architect tomonidan yoziladi. `tickets/RG-4-self-checkout-decision.md` asosida: egasi
> kiosk rejimini SO'RAGANI tasdiqlandi (to'g'ridan-to'g'ri so'rab, avtomatik qabul qilinmadi).
> Auth modeli (markaziy arxitektura savoli) alohida muzlatilgan: `tickets/DESIGN-self-checkout-
> auth.md`. **Bu safar faqat SPEC+DESIGN — kod yozilmagan, ticket (SC-1, SC-2...) ochilmagan.**
> Egasi ushbu hujjatni ko'rib chiqgandan keyin PM implementatsiya ticketlarini ochadi.

## Niyat (1 abzats)

REGOS'ning "SelfPOS" — mijoz o'zi mahsulotni skanerlab, kassir login qilmasdan to'laydigan
kiosk rejimi — Aniq ERP'da so'raldi. Hozir barcha sotuv yo'llari (`pos/page.tsx`, `m/pos/page.tsx`,
B2B portal, B2C storefront) login qilgan xodim YOKI to'liq anonim-masofaviy mijoz orqali
ishlaydi; **"jismonan do'konda turgan, lekin xodim emas" uchinchi holat yo'q**. Ushbu SPEC shu
bo'shliqni yopadi: mavjud `create_sale_core()` orqali HAQIQIY sotuv yaratiladigan, lekin
butunlay yangi old eshik (qurilma-token, mijoz-interfeysi) orqali ishlaydigan rejim.

## Tegishli foydalanuvchi

- **Mijoz (kiosk oldida turgan, login qilmagan)** — asosiy foydalanuvchi, `apps/web/app/
  (kiosk)/kiosk/*` ekranini ko'radi.
- **`admin`** — kiosk qurilmalarini ro'yxatdan o'tkazadi/bekor qiladi (`kiosk.*` ruxsatlari,
  `DESIGN-self-checkout-auth.md`).
- **Xodim (zalda, rolga bog'liq emas)** — kiosk sotuvlarini kuzatish/bekor qilish uchun mavjud
  `/sale/sales` ro'yxatidan foydalanadi (yangi UI yo'q, pastdagi "Nazorat" bo'limiga qarang).

## MUHIM: egasi uchun aniq tan olinishi kerak bo'lgan tavakkal (yashirilmaydi)

REGOS o'zining SelfPOS'ini **katta supermarket tarmoqlari** (zalda loss-prevention xodimi doim
bor, kameralar, vazn-tekshiruv platformasi) uchun qurgan — bu "nazoratsiz" emas, balki
"**boshqa turdagi nazorat**" (inson zalda yuradi, lekin har bir tranzaksiyani kassir sifatida
bosmaydi). Aniq ERP'ning haqiqiy mijoz segmenti (kichik-o'rta chakana do'kon) odatda bunday
maxsus loss-prevention xodimiga ega emas.

**Shu sababli bu SPEC kiosk'ni "xodimsiz" deb emas, "xodim-yengil" (staff-light) deb
loyihalaydi**: pastdagi MUST-talablar (savat chegarasi, to'liq audit yozuvi, to'lov
tasdiqlanmaguncha mijozni chiqarib yubormaslik) — haqiqiy loss-prevention xodimi yo'qligini
qoplashga urinadigan **arzon, dasturiy** choralar, ularning o'rnini bosuvchi emas. Egasi buni
**pilot sifatida bitta filialda**, aniq savat-chegarasi bilan ishga tushirishni, va "nol-xodim"
degan noto'g'ri tasavvur bilan reklama qilmaslikni ko'rib chiqishi tavsiya etiladi.

## Acceptance criteria (Given/When/Then)

**Scenario 1: Happy path — mijoz o'zi skanerlab to'laydi**
- **Given** faol (`status='active'`) kiosk qurilmasi, kassasi ochiq kassa-smenaga ega,
  to'lov provayderi (click/payme) yoqilgan
- **When** mijoz 3 ta mahsulotni skanerlaydi, "To'lash"ni bosadi, QR/karta orqali to'laydi
- **Then** `sales` jadvalida yangi yozuv (status boshida `confirmed`, keyin `paid`),
  ombordan (kassaning bog'langan omboridan) mos miqdor ayiriladi, `kiosk_orders.status='paid'`,
  ekranda "Tasdiqlandi, xayr" ko'rinadi

**Scenario 2: Savat chegarasidan oshib ketish — bloklanadi**
- **Given** org sozlamasida `kiosk.max_cart_amount = 500000`
- **When** mijoz savati 650000 so'mga yetadi va "To'lash"ni bosadi
- **Then** `422` ("Savat qiymati juda katta — kassaga murojaat qiling", `code:
  "cart_limit_exceeded"`), sotuv YARATILMAYDI, ombordan hech narsa ayirilmaydi

**Scenario 3: Bekor qilingan/noma'lum token**
- **Given** admin kioskni "Revoke" qilgan
- **When** shu kiosk `GET /api/v1/kiosk/session` so'rovini yuboradi
- **Then** `401`, kiosk ekranida "Qurilma faol emas — administratorga murojaat qiling"

**Scenario 4: Og'irlik bilan sotiladigan mahsulot — kiosk katalogida yo'q**
- **Given** mahsulot birligi `kg`/`g` (tarozi bilan sotiladigan)
- **When** mijoz uning shtrix-kodini (agar mavjud bo'lsa) skanerlaydi
- **Then** kiosk "mahsulot topilmadi" ko'rsatadi (staff POS'dan farqli — kiosk bunday
  mahsulotlarni UMUMAN qidirmaydi/sotmaydi, Talablar bo'limi, MUST)

**Scenario 5: To'lov provayderi yoqilmagan (bugungi haqiqiy holat)**
- **Given** org'da click/payme ikkisi ham `enabled=false` (bu sessiyada boshqa joyларда
  qayd etilgan blokirovka — merchant kredensiallari yo'q)
- **When** mijoz savatni to'lashga harakat qiladi
- **Then** `201` qaytadi, lekin `payment.mode = "unavailable"`, ekranda "To'lov tizimi hali
  ulanmagan — kassaga murojaat qiling" — **sotuv `awaiting_payment` holatida xodim
  aralashuvini kutadi** (Scenario bu holatni YASHIRMAYDI — bu bugungi real blokirovka,
  pastda "Ishga tushirish to'siqlari"da qayd etilgan)

**Scenario 6: Narx mijoz tomonidan o'zgartirilishi mumkin emas**
- **Given** mijoz brauzer devtools orqali checkout so'rovi tanasiga `price` maydonini
  qo'shishga harakat qiladi
- **When** `POST /api/v1/kiosk/checkout` qabul qilinadi
- **Then** server `price`ni E'TIBORGA OLMAYDI — har doim `products.sale_price`dan server
  tomonda qayta hisoblaydi (staff POS'dagi "client narx yuboradi" ishonchiga asoslangan
  shartnoma BU YERDA ISHLAMAYDI — pastda Talablar, MUST)

**Scenario 7: Cross-tenant izolyatsiya**
- **Given** Org A kiosk qurilmasi
- **When** u `GET /api/v1/kiosk/order/{sale_id}` so'rovini Org B'ning sale_id'si bilan yuboradi
- **Then** `404` (na borligi, na sababi oshkor qilinmaydi)

## Talablar (RFC 2119)

### Auth (to'liq tafsilot: `DESIGN-self-checkout-auth.md`)
- **MUST**: Har bir kiosk so'rovi `Authorization: Bearer kiosk_<token>` orqali autentifikatsiya
  qilinsin; token admin tomonidan oldindan chiqarilgan, bitta `cashbox_id`ga bog'langan bo'lsin.
- **MUST**: Token bekor qilinishi/almashtirilishi keshlanmasin — keyingi so'rovda zudlik bilan
  amal qilsin.
- **MUST NOT**: Kiosk endpointlari inson RBAC (`X-Organization-Id` + user JWT) orqali
  ishlamasin — org/ombor/kassa qurilma tokenidan aniqlansin, headerdan emas.

### Katalog / mahsulot ko'rinishi
- **MUST**: Kiosk katalogida faqat: `is_active=TRUE AND is_archived=FALSE AND is_service=FALSE
  AND barcode IS NOT NULL AND units.short_name NOT IN ('kg','g')` shartlariga mos mahsulotlar
  ko'rsin/qidirilsin.
- **MUST**: Mahsulot narxi, mavjudligi har doim qurilmaning bog'langan omboridan (cashbox →
  warehouse) server tomonda o'qilsin — mijoz tomonidan yuborilgan har qanday narx/miqdor
  e'tiborga olinmasin (Scenario 6).
- **SHOULD**: Qidirish faqat shtrix-kod skaneri orqali (nom bo'yicha qo'lda qidirish ixtiyoriy,
  V1'da MAY — staff POS'ning "nom bo'yicha qidirish" grid'i kiosk'da shart emas, chunki
  o'z-o'zini xizmat qilish ssenariysi har doim fizik skanerlashdan boshlanadi).

### Checkout / to'lov
- **MUST**: `POST /api/v1/kiosk/checkout` mavjud `sale_service.create_sale_core()` orqali
  haqiqiy sotuv yaratsin — yangi, parallel sotuv-yozish yo'li qurilmasin.
- **MUST**: Checkout `Idempotency-Key` headerini qabul qilsin va idempotency middleware
  whitelist'iga qo'shilsin (ikki marta bosish/tarmoq-retry'dan himoya — mavjud naqsh,
  `tickets/DESIGN-pos-offline.md`da allaqachon isbotlangan).
- **MUST**: Savat jami summasi `app_settings['kiosk'].max_cart_amount` (org-darajasida
  sozlanadigan, `null` = cheksiz) dan oshsa, checkout `422` bilan rad etilsin (Scenario 2).
- **MUST**: To'lov mavjud `payment_transactions`/click/payme sirtidan foydalansin
  (`integration/payments/base.py`) — yangi to'lov protokoli YOZILMASIN.
- **MUST**: Kiosk ekrani to'lov `paid` deb tasdiqlanmaguncha "muvaffaqiyatli/chiqishingiz
  mumkin" holatini ko'rsatmasin (`GET /api/v1/kiosk/order/{sale_id}` orqali so'rab turish,
  timeout ~90 soniya → "Xodimga murojaat qiling").
- **MUST NOT**: Naqd pul V1'da qo'llab-quvvatlanmasin (pastda QILMAYMIZ).

### Loss-prevention / suiste'mol
- **MUST**: Har bir kiosk sotuvi audit_log'ga to'liq item-darajasida yozilsin (mahsulot,
  miqdor, narx, qurilma id) — xuddi storefront checkout `log_action(..., user_id=None, ...)`
  qiladigan tartibda.
- **MUST**: Har bir kiosk sotuvi `source_type='sale_kiosk'` bilan belgilansin (stock_movements
  va accounting journal'da) — hisobot/shrinkage tahlili kiosk sotuvlarini xodim-sotuvlaridan
  ajrata olsin.
- **SHOULD**: Kiosk savati N daqiqa harakatsiz qolsa (standart 3 daqiqa, sozlanadigan)
  avtomatik tozalansin — "tashlab ketilgan savat" muallaqlikda qolmasin.
- **MAY (zahira, V1'da ishlamaydi, lekin ma'lumot ustuni tayyorlansin)**: tasodifiy
  foiz-asosida "xodim tekshiruvi" belgisi (`kiosk_orders.requires_staff_check`) —
  ustun qo'shiladi, lekin UI/navbat V1'da QURILMAYDI (pastda QILMAYMIZ).

### Uskuna
- **MUST**: Shtrix-kod skaneri — mavjud kamera-asosidagi `BarcodeScanner` komponenti
  (`apps/web/app/m/pos/page.tsx`da ishlatilgan) qayta ishlatilsin — yangi drayver/integratsiya
  yozilmasin.
- **MUST NOT**: Tarozi (Web Bluetooth/Serial) integratsiyasi V1'da kiosk'ga ulanmasin
  (Scenario 4 — og'irlik-asosidagi mahsulotlar kiosk katalogidan butunlay chiqarib
  tashlanadi, shu bilan ehtiyoj yo'qoladi).
- **SHOULD**: Chek — raqamli (ekran/SMS-havola) bo'lsin asosiy yo'l sifatida; Bluetooth
  ESC/POS chop etish (`bt-printer.ts`, mavjud) ulansa bo'ladi, lekin MUST emas (qog'oz
  tugashi — nazoratsiz kiosk uchun operatsion muammo, V1 doirasidan tashqarida).

## QILMAYMIZ (qamrov-tashqarisida) — nima deyarli kiritildi, lekin kiritilmadi

- ❌ **Naqd pul to'lovi** — naqd qabul qiluvchi/qaytim beruvchi uskuna integratsiyasi yo'q;
  nazoratsiz kiosk uchun naqd amaliy emas (vazifa ta'rifida ham to'g'ridan-to'g'ri tan olingan).
- ❌ **Vazn-tekshiruv platformasi** (butun savatni tortib, kutilgan og'irlikka solishtirish) —
  bu REGOS'ning haqiqiy loss-prevention xususiyati, lekin **yangi, kalibrlangan uskuna**
  talab qiladi (mavjud mahsulot-tarozisi bilan bir xil emas). Alohida, kattaroq spec/loyiha.
- ❌ **"Xodim tekshiruvi" navbati/UI** (tasodifiy foiz bilan to'xtatib, zaldagi xodimga
  bildirish) — faqat ma'lumot-ustuni (`requires_staff_check`) zahira qilinadi, ishlovchi
  oqim keyingi sprintga qoldiriladi.
- ❌ **Haqiqiy pre-authorization/stock-hold** (to'lov tasdiqlangunga qadar ombordan
  AYIRMASLIK) — strukturaviy jihatdan xavfsizroq, lekin `create_sale_core()` (3 boshqa
  chaqiruvchi — staff POS, B2B, B2C — bilan baham ko'rilgan umumiy funksiya) semantikasini
  o'zgartirishni talab qiladi — bu **boshqa, cross-cutting spec**, bu yerga bog'lab
  qo'yilmaydi. Hozirgi dizayn (storefront bilan bir xil: sotuv darhol yaratiladi, to'lov
  keyin tasdiqlanadi) qabul qilingan qoldiq-tavakkal — pastda "Qoldiq tavakkal" bo'limida.
- ❌ **Native/qulflangan kiosk-rejim ilovasi** (tablet'ni "kiosk mode"da qulflash, boshqa
  ilovaga chiqishni bloklash) — bu qurilma-boshqaruv (MDM) masalasi, kiosk tablet'ning
  operatsion tizim darajasida sozlanishi, bu loyihaning veb-ilova qamrovidan tashqarida.
  Brauzer to'liq ekran rejimi (CSS/JS fullscreen API) bilan cheklaniladi.
- ❌ **Offline rejim** — kiosk internet uzilganda ishlay olmaydi (storefront/portal bilan
  bir xil — `DESIGN-pos-offline.md`dagi B-variant doirasidan tashqarida, chunki u faqat
  staff POS uchun loyihalashtirilgan).
- ❌ **Nom bo'yicha qo'lda qidirish grid'i** (staff POS'dagi kabi) — kiosk faqat
  skanerlash-birinchi UX, SHOULD darajasida MAY sifatida qoldirilgan.
- ❌ **Mavjud `devices` jadvalini kengaytirish** — rad etish sababi `DESIGN-self-checkout-
  auth.md`da batafsil.

## Qoldiq tavakkal (yashirilmaydi) — "to'lov tasdiqlanmagan, ombor allaqachon kamaygan"

`create_sale_core()` sotuv yozuvini yaratish bilan BIR VAQTDA ombordan ayiradi — to'lovdan
AJRATILGAN holda. Demak: mijoz checkout'ni boshlagan, ombor kamaygan, lekin to'lov hali
tasdiqlanmagan qisqa oyna mavjud (storefront bugun ham aynan shu modelda ishlaydi). Masofaviy
storefront uchun bu xavfsiz (tovar hali yetkazilmagan, xodim ulgurib bekor qila oladi) — lekin
**kiosk uchun mijoz jismonan tovarni qo'lida ushlab turgan**, shuning uchun:
- **MUST**: Kiosk ekrani to'lov `paid` bo'lmaguncha mijozni "ketishi mumkin" holatiga
  o'tkazmasin (blokirovka qiluvchi kutish ekrani, Talablar bo'limida yuqorida).
- **SHOULD**: Xodimlar uchun "to'lovni kutayotgan kiosk sotuvlari" ko'rinishi — yangi UI
  QURILMAYDI, mavjud `/sale/sales?status=confirmed` ro'yxatiga filtr sifatida qo'shiladi
  (arzon, implementatsiya ticketida hal qilinadi).
- Agar mijoz to'lovni yakunlamay tark etsa — sotuv `awaiting_payment`/`payment_failed`
  holatida qoladi, xodim mavjud `POST /sales/{id}/cancel` (ombor avtomatik qaytariladi)
  orqali qo'lda bekor qiladi. **Bu qo'lda jarayon — avtomatlashtirilmagan, V1'da ataylab**.

## Ishga tushirish to'siqlari (blocker, yashirilmaydi)

Bu loyihaning boshqa qismlarida allaqachon qayd etilgan: click/payme to'lov provayderlari
kod darajasida tayyor, lekin **haqiqiy merchant kredensiallari bilan faollashtirilmagan**.
Kiosk'ning yagona amaliy to'lov yo'li (karta/QR gateway) aynan shu provayderlarga tayanadi —
demak **kiosk production'da ishga tushishidan oldin shu blokirovka alohida hal qilinishi
kerak** (Scenario 5 buni aniq ko'rsatadi: bugun kiosk `payment.mode="unavailable"` bilan
javob qaytaradi).

## Rollback rejasi

- **DB**: `DROP TABLE IF EXISTS kiosk_orders; DROP TABLE IF EXISTS kiosk_devices;` — ikkalasi
  ham yangi, mavjud funksionallik ularga bog'liq emas.
- **Code**: yangi modul (`app/modules/kiosk/`) + yangi frontend route guruhi (`(kiosk)/`) —
  PR revert xavfsiz, mavjud staff POS/B2B/B2C yo'llariga tegilmagan.
- **RBAC**: `kiosk.*` permission kodlari DB'da qoladi (zararsiz, hech kim ularga tayanmaydi
  agar middleware/router kodi olib tashlansa).
- **User-facing**: kiosk route'ini reklama qilmaslik/jismoniy qurilmani o'chirib qo'yish
  kifoya — xodimlar POS'iga ta'sir yo'q.

## Tegishli modullar

- `apps/api/app/modules/sale/service.py::create_sale_core()` — o'zgarmaydi, qayta ishlatiladi
- `apps/api/app/modules/storefront/` — naqsh-referens (anonim checkout, to'lov integratsiyasi,
  order-lookup) — nusxalanadi, import qilinmaydi (kiosk mustaqil modul, `DESIGN-self-checkout-
  auth.md`dagi sabab)
- `apps/api/app/modules/rbac/` — `kiosk.*` permission qo'shiladi, middleware skip-list
- `apps/api/app/modules/idempotency/middleware.py` — whitelist + org-resolver
- `apps/api/app/modules/integration/payments/base.py` — to'lov holati (o'zgarmaydi)
- `apps/web/app/m/pos/page.tsx` — `BarcodeScanner` komponenti qayta ishlatiladi
- `apps/web/app/(shop)/` — frontend route-guruh naqshi (layout ajratish) — nusxa referens

## O'zbek bozori xosligi

- **OFD**: ✗ tegmaydi bu sprintda (mavjud chek/soliq oqimi o'zgarmaydi)
- **MXIK**: ✗ tegmaydi (mahsulot ma'lumotlari o'zgarmaydi)
- **QQS**: ✗ tegmaydi
- **TIN/STIR**: ✗ tegmaydi (kiosk mijozi chakana, STIR so'ralmaydi)
- **SMS (Eskiz)**: ✓ ixtiyoriy — raqamli chek SMS orqali yuborilishi MAY (mavjud SMS
  infratuzilmasi qayta ishlatiladi, yangi integratsiya yo'q)
- **To'lov**: ✓ asosiy mavzu — click/payme (mavjud, faollashtirilmagan — yuqoridagi blocker)

## Effort estimation (implementatsiya ticketlari ochilgandan KEYIN aniqlashtiriladi)

- Backend (auth + checkout + admin CRUD): M (bir necha kun)
- Frontend (kiosk ekrani + admin provisioning UI): M (bir necha kun)
- **Bu safar ticket OCHILMAYDI** — egasi SPEC+DESIGN'ni tasdiqlagandan keyin PM `SC-1, SC-2...`
  implementatsiya ticketlarini alohida navbatda ochadi.
- ⚠️ **Amalda bu qoida buzildi** (2026-10-12): SC-1..6 shu tasdiqdan oldin ochilib, to'liq
  implementatsiya qilindi. Qaror holati va ochiq qolgan savollar uchun qarang
  `tickets/RG-4-self-checkout-decision.md`.

## Tasdiqlash kerak bo'lgan ochiq savollar (egasi uchun, implementatsiyadan OLDIN)

1. Pilot qaysi bitta filialda/qaysi kassada ishga tushadi?
2. `max_cart_amount` standart qiymati nima bo'lsin (yoki cheksiz qoldirilsinmi — tavsiya
   etilmaydi, Scenario 2'ning o'zi shart emas bo'lib qoladi)?
3. Click/Payme merchant kredensiallari qachon faollashtiriladi — kiosk shundan oldin
   "demo/ko'rsatish" rejimida (to'lovsiz, faqat UI) ishga tushsinmi, yoki to'liq
   bloklanib tursinmi?
