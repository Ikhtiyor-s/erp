# SPEC — POS: Real Hardware Integration — skaner / tarozi / chek printeri (2026-10-12)

> PM tomonidan yoziladi. Bu **PROPOSE** bosqichi.
> Diqqat: bu katta "POS hardware" talabining HARDWARE yarmi — barcode/scale/receipt/cash-drawer,
> barchasi **browser-side** (Web Serial / Web Bluetooth / window.print()) qaror. Offline-rezilientlik
> (IndexedDB queue + sync) ATALOQAN alohida `tickets/SPEC-pos-offline.md`ga chiqarilgan — sabab
> pastda "Nega ikki spec" va o'sha specning Niyat qismida. Ticket fayllari umumiy prefiks: `POS-*`
> (eski `T-*`/`EC-*` bilan to'qnashmaslik uchun ataylab yangi). Bu SPEC → `POS-1`..`POS-4`.

## Nega ikki spec (qisqa)

Kod bazasini o'qib chiqqandan keyin ma'lum bo'ldi: **barcode skanerlash (HID + kamera) va tarozi
(desktop, WebSerial) allaqachon ishlab turgan kod** — bu avvalgi sprint (`tickets/T-102`,
`T-134`-arxivlanmagan debris) natijasi. Qolgan haqiqiy bo'shliq — **chek printeri hech qayerga
ulanmagan**, garchi buning uchun kerakli qurilish bloklari (`lib/bt-printer.ts`, `/settings/receipt`,
`/settings/print-templates`, `/settings/devices`) allaqachon yozilgan va **ishlatilmaydi**. Demak bu
spec asosan — "mavjud, lekin bir-biriga ulanmagan bo'laklarni ulash" + bir nechta aniq topilgan
bug/UX kamchiliklarini tuzatish, YANGI arxitektura o'ylab topish emas. Offline-rezilientlik esa butunlay
boshqa tur savol (arxitektura tanlovi, noaniqlik yuqori) — shuning uchun alohida spec.

## Niyat (1 abzats)

Aniq ERP POS ekranida (`apps/web/app/(dashboard)/pos/page.tsx`, mobil variant `apps/web/app/m/pos/page.tsx`)
kassir mahsulotni skanerlab/tanlab, og'irligini o'qib sotuvni yakunlay oladi — lekin sotuv tugagandan
keyin **chek chop etilmaydi** va **kassa qutisi ochilmaydi**: `checkout()` funksiyasi faqat `toast.success`
ko'rsatib savatni tozalaydi (`pos/page.tsx:159-188`). Shu bilan birga admin `/settings/receipt` va
`/settings/print-templates` sahifalarida chek formatini (58/80mm, header/footer, `auto_print` belgisi)
va shablon matnini (`{org_name}`, `{doc_number}`, `{items}`, `{total}` placeholder'lari) sozlay oladi —
ammo bu sozlamalarni HECH KIM o'qimaydi/qo'llamaydi. Natija: do'konda kassir chekni telefon kamerasi
bilan rasmga olib yoki qog'ozga qo'lda yozib berishga majbur, garchi ESC/POS chop etish kodi
(`lib/bt-printer.ts`) allaqachon mavjud bo'lsa ham. Kerakli foydalanuvchi: **kassir** (kuniga yuzlab
marta "to'landi" tugmasini bosadi) va **admin/manager** (chek formatini sozlaydi).

## Tegishli foydalanuvchi

- **Asosiy**: `kassir` — POS ekranida sotuvni yakunlaydi, chekni chop etadi, kassa qutisini ochadi
- **Ikkinchi darajali**: `admin`/`manager` — `/settings/devices`, `/settings/print-templates`,
  `/settings/receipt` orqali qurilma va chek formatini sozlaydi

## Acceptance criteria (Given/When/Then)

**Scenario 1: Barcode skaner + qidiruv input ziddiyati (TOPILGAN BUG, tuzatish kerak)**
- **Given** kassir POS ekranida, qidiruv input (`<input placeholder="Поиск товара...">`) fokusda
- **When** USB HID barcode skaner barcode'ni tezlikda "yozadi" + Enter yuboradi
- **Then** barcode FAQAT savatga mahsulot sifatida qo'shiladi; qidiruv input'da bo'sh/tozalangan holat
  qoladi va `loadProducts` har bir belgi uchun QAYTA-QAYTA chaqirilmaydi (hozir: `useBarcodeScanner`
  default `ignoreInInputs=false` bo'lgani uchun window-level listener VA input'ning o'z `onChange`'i
  bir xil keydown'larni parallel qayta ishlaydi — ikkalasi ham ishga tushadi, natijada API thrash +
  chalkash UI holati)

**Scenario 2: Sotuv tugagandan keyin avtomatik chek chop etish**
- **Given** `/settings/receipt`da `auto_print=true`, brauzerda Web Bluetooth printer allaqachon ulangan
- **When** kassir "Оплатить" tugmasini bosadi va `/sale/sales` 201 qaytaradi
- **Then** `/settings/print-templates`dagi `kind=receipt, is_default=true` shablon placeholder'lari
  (`{org_name}`, `{doc_number}`, `{sale_date}`, `{items}`, `{total}`, `{paid}`, `{footer}`) haqiqiy
  sotuv ma'lumoti bilan to'ldirilib, `lib/bt-printer.ts`dagi `printReceipt()` orqali ESC/POS ko'rinishda
  chop etiladi — kassir qo'shimcha tugma bosmasdan

**Scenario 3: Printer ulanmagan / Web Bluetooth qo'llab-quvvatlanmaydigan brauzer — fallback**
- **Given** kassir brauzeri Web Bluetooth'ni qo'llamaydi (masalan desktop Linux Chrome yoki iOS Safari)
  YOKI hali hech qanday printer ulanmagan
- **When** sotuv tugaydi (yoki kassir qo'lda "Chekni chop etish" bosadi)
- **Then** tizim xatolik bilan to'xtab qolmaydi — `window.print()` asosidagi HTML fallback (58/80mm
  `@page` CSS, xuddi `components/barcode/label-print.tsx`dagi naqsh) bir xil shablon ma'lumotlari
  bilan ochiladi

**Scenario 4: Kassa qutisini ochish**
- **Given** chek printeri Web Bluetooth orqali ulangan (printer DK portiga kassa qutisi simi ulangan)
- **When** kassir "Qutini ochish" tugmasini bosadi (yoki `auto_print` bilan birga avtomatik)
- **Then** ESC/POS pulse komandasi (`0x1B 0x70 0x00 0x19 0xFA`, Biznes POS'ning `cash-drawer.service.ts`
  dagi standart komanda) xuddi shu Bluetooth characteristic orqali yuboriladi — yangi qurilma turi
  qo'shilmaydi, printer kanali qayta ishlatiladi

**Scenario 5: Mobil POS'da tarozi — qaror va (agar tasdiqlansa) ulash**
- **Given** mobil POS (`app/m/pos/page.tsx`) hozir hech qanday tarozi integratsiyasiga ega emas
  (WebSerial telefon brauzerlarida qo'llab-quvvatlanmaydi)
- **When** POS-4 arxitektura qarori chiqadi
- **Then** YOKI (a) mobil tarozi — Web Bluetooth orqali (`lib/bt-printer.ts`dagi ishlatilmagan
  `readScale()`) qo'shiladi, YOKI (b) ushbu safar WON'T DO deb hujjatlashtiriladi — ikkalasi ham
  "aniqlanmagan holat" emas, yozma qaror

**Scenario 6: Ko'p-tashkilotli izolyatsiya (mavjud, regressiyasiz saqlanishi kerak)**
- **Given** `/settings/devices` va `/settings/print-templates` allaqachon `organization_id` bo'yicha
  filtrlangan (`settings/router.py:187-269`, tasdiqlangan)
- **When** yangi "shablonni qo'llash" logika qo'shiladi
- **Then** u ham faqat joriy sessiya `org_id`siga tegishli shablon/qurilmani o'qiydi — yangi
  cross-tenant leak yo'q

## Talablar (RFC 2119)

- **MUST**: Chop etish/kassa qutisi/tarozi — barchasi brauzer tomonida (Web Bluetooth / Web Serial /
  `window.print()`) amalga oshirilishi shart; backend (FastAPI) hech qanday TCP/serial/Bluetooth
  qurilmaga to'g'ridan-to'g'ri ulanmasligi shart (sabab: Aniq ERP backend markaziy/bulut xizmat,
  do'kon LAN'ida emas — Biznes POS'ning Node-asosidagi `scales.service.ts`/`cash-drawer.service.ts`
  modeli bu yerda ishlamaydi)
- **MUST**: `checkout()` muvaffaqiyatli bo'lgandan keyin chop etish xatosi sotuvni BEKOR qilmasligi
  shart — sotuv allaqachon `/sale/sales`da yaratilgan, chop etish ikkinchi, mustaqil qadam
  (xato bo'lsa — toast + "qayta chop etish" tugmasi, sotuv status o'zgarmaydi)
- **MUST**: `printReceipt()` chaqiruvi `/settings/print-templates`dagi `kind=receipt, is_default=true`
  shablon mavjud bo'lmaganda ham ishlashi shart (built-in default matn — `print-templates/page.tsx`
  dagi `DEFAULT_BODY`ga o'xshash)
- **MUST**: Web Bluetooth qurilma tanlash oynasi `acceptAllDevices:true` o'rniga
  `filters:[{services: SERVICE_UUIDS}]` ishlatishi shart — hozir har qanday yaqin BT qurilma
  (quloqchin, telefon) ro'yxatda chiqadi, bu amaliy foydalanish muammosi
- **SHOULD**: Kassa qutisini ochish tugmasi faqat printer ulangan holatda ko'rinadi/faollashadi
- **SHOULD**: Mobil POS'da kamera-skaner bilan qo'lda kiritilgan/skanerlangan barcode `onScan`
  ichida ham desktopdagi kabi narx-ichiga-yozilgan EAN-13 (price/weight-embedded) formatini hisobga
  olish imkoniyati ko'rib chiqilsin (hozir faqat `barcode=` exact-match qidiradi, Biznes POS'ning
  `barcode.service.ts`dagi `parsePriceEmbeddedEAN13` naqshi — agar UZ supermarket tarozi-yopishtirgich
  ishlatilsa kerak bo'ladi; agar bu mijozlarda ishlatilmasa — WON'T DO, POS-4da hal qilinadi)
- **MAY**: Oldin ulangan Bluetooth printerni keyingi sessiyada avtomatik qayta ulash
  (`navigator.bluetooth.getDevices()` + saqlangan ruxsat) — brauzer support cheklangan, stretch goal

## QILMAYMIZ (qamrov-tashqarisida)

- ❌ Biznes POS'ning Node/TypeScript `hardware/` modulini (backend TCP/serial xizmatlari) ko'chirib
  olish — boshqa til, boshqa deployment modeli (on-premise LAN server vs markaziy bulut API);
  shuning uchun faqat PROTOKOL (ESC/POS bytelar, CAS/Mettler tarozi format) ma'lumot manbai sifatida
  ishlatiladi, kod emas
- ❌ WebUSB printer qo'llab-quvvatlash — Web Bluetooth + HTML fallback'ning ikkisi ham allaqachon
  qisman qurilgan, WebUSB uchun printer-modelga xos vendor driver kerak bo'ladi — ortiqcha murakkablik
- ❌ Lokal printer-agent/driver xizmati (Xprinter loyihasidagi Django agent uslubida) — alohida,
  mustaqil loyiha, bu sprintga kirmaydi
- ❌ iOS Safari'da Web Bluetooth chop etish — platforma qo'llamaydi, faqat HTML/`window.print()`
  fallback orqali qoplanadi, native ilova yozilmaydi
- ❌ Mahsulot etiketkasi chop etish (`label-print.tsx`, T-102/103/134/135) — bu ALLAQACHON qurilgan,
  ishlab turgan, alohida feature; bu spec faqat CHEK (sotuv tasdiqlash hujjati) haqida
- ❌ Oldin ulangan BT qurilmani sessiyalar orasida avtomatik eslab qolish/qayta ulash — MAY, majburiy
  emas, keyingi safar
- ❌ Printer/tarozi qurilma holatini backend DB (`devices` jadvali)da real-time saqlash yoki
  "online/offline" status ko'rsatish — hozircha `devices` jadval faqat statik ro'yxat (metadata),
  runtime holat frontend state'da qoladi

## Rollback rejasi

- **Code**: barcha o'zgarish frontend (`apps/web`) ichida, backend endpoint o'zgarmaydi (mavjud
  `/sale/sales`, `/settings/print-templates`, `/settings/devices` o'zgarishsiz ishlatiladi) — revert =
  PR revert, backend'ga tegmaydi
- **User-facing**: agar chop etish muammoli bo'lsa — "auto_print" sozlamasini `false` qilib o'chirish
  kifoya, kassir qo'lda eski rejimda ("chek yo'q, faqat toast") davom etadi
- **DB**: yangi ustun/jadval REJALASHTIRILMAGAN (mavjud `devices`/`print_templates`/`settings`
  jadvallari ishlatiladi) — agar POS-4 mobil tarozi uchun yangi config kaliti qo'shsa, u ham nullable/
  default bo'lib xavfsiz qoladi

## Tegishli modullar

- `apps/web/app/(dashboard)/pos/page.tsx` — desktop POS, `checkout()` funksiyasi (161-188-qatorlar),
  skaner/tarozi toolbar (254-290)
- `apps/web/app/m/pos/page.tsx` — mobil POS, `checkout()` (122-146), `onScan` (103-117)
- `apps/web/lib/scanner.ts` — `useBarcodeScanner` (HID wedge), `openSerialScale`/`isWebSerialSupported`
  (WebSerial, desktop-only) — ISHLAB TURGAN, faqat Scenario 1 bugini tuzatish kerak
- `apps/web/components/barcode/scanner.tsx` — kamera skaner (`BarcodeDetector`/zxing), mobil POS'da
  ishlatiladi — ISHLAB TURGAN, o'zgarishsiz
- `apps/web/lib/bt-printer.ts` — ESC/POS builder, `btPrint`, `printReceipt`, `readScale`
  (Web Bluetooth) — MAVJUD, LEKIN HECH QAYERDA ISHLATILMAYDI (grep tasdiqlandi), bu spec asosiy ish
  joyi
- `apps/web/app/(dashboard)/settings/receipt/page.tsx` — chek format sozlamalari (`width_mm`, `header`,
  `footer`, `show_logo`, `show_barcode`, `auto_print`) — MAVJUD, qo'llanilmaydi
- `apps/web/app/(dashboard)/settings/print-templates/page.tsx` + `apps/api/.../settings/router.py`
  (`/print-templates` CRUD, 259-329-qatorlar) — MAVJUD, backend ishlaydi, frontend POS tomonidan
  o'qilmaydi
- `apps/web/app/(dashboard)/settings/devices/page.tsx` + backend `/devices` CRUD (187-245-qatorlar) —
  MAVJUD, printer/skaner/tarozi/kassa-qutisi ro'yxati, runtime bilan bog'lanmagan
- `apps/web/components/barcode/label-print.tsx` — `window.print()` + `@page` CSS naqshi, HTML fallback
  uchun namuna (o'zgartirilmaydi, faqat referens)

## O'zbek bozori xosligi

- **OFD**: ✗ tegmaydi bu sprintda — chek chop etish fiskal OFD integratsiyasi emas, oddiy mijoz
  nusxasi (termal chek)
- **MXIK**: ✗ tegmaydi
- **QQS**: ✗ tegmaydi
- **TIN/STIR**: ✗ tegmaydi
- **SMS (Eskiz)**: ✗ tegmaydi
- **To'lov**: ✗ tegmaydi (mavjud `/sale/sales` to'lov logikasiga tegilmaydi, faqat chop etish ustiga
  qo'shiladi)
- **Qurilma bozori**: ✓ markazda — UZ bozorida keng tarqalgan 58/80mm Bluetooth ESC/POS termoprinterlar
  (Xprinter, Goojprt) va CAS/Mettler seriyali elektron tarozilar nazarda tutilgan

## Risklar

- Web Bluetooth brauzer qo'llab-quvvatlashi notekis (Chrome/Edge/Android — ha; Firefox/Safari/iOS —
  yo'q/qisman) — HTML fallback shart, lekin fallback'da avtomatik chop etish (auto-print) brauzer
  xavfsizlik siyosati tufayli ko'pincha mumkin emas (foydalanuvchi ishorasi kerak) — kassir baribir
  bir marta "OK/Print" bosishi kerak bo'lishi mumkin, bu `auto_print` sozlamasining real kutilmasini
  cheklaydi
- `lib/bt-printer.ts`dagi kod HECH QACHON production'da sinalmagan (grep bo'yicha hech qayerda
  chaqirilmagan) — real Xprinter/Goojprt qurilmada test qilinmaguncha ESC/POS byte formatining haqiqiy
  mosligi tasdiqlanmagan
- Kassa qutisini "printer kanali orqali" ochish — agar kassir hali printer ulamagan bo'lsa, qutini
  mustaqil ochish imkoni yo'q (alohida qurilma emas); bu amaliy cheklov, mijozga tushuntirish kerak
- Scenario 1 bugini tuzatishda `ignoreInInputs` yoki boshqa yondashuv tanlovi UI oqimini o'zgartirishi
  mumkin (masalan input avtomatik tozalanishi) — frontend-dev aniq UX qarorini tanlashi kerak,
  bu SPEC faqat muammoni va kutilayotgan natijani belgilaydi

## Ochiq savollar

- Do'konlarda qaysi aniq printer modeli/markasi ishlatiladi? (`lib/bt-printer.ts` SERVICE_UUIDS faqat
  "eng keng tarqalgan" uchta UUID'ni nazarda tutadi — boshqa modelga mos kelmasligi mumkin, real
  qurilmada sinov kerak)
- Mobil POS uchun tarozi real talab qilinadimi (do'konlarda gazlamachilik/oziq-ovqat kabi vaznli
  mahsulot sotiladimi), yoki bu faqat desktop-kassa stsenariysimi? — POS-4 ticketda hal qilinadi,
  bu yerda taxmin qilinmaydi
- `auto_print` yoqilganda, agar bir nechta printer `/settings/devices`da ro'yxatda bo'lsa — qaysi
  birini ishlatish kerak? (hozirgi taxmin: faqat joriy sessiyada Web Bluetooth orqali ulangan birtasi,
  `/settings/devices` ro'yxati hali ham faqat metadata/eslatma sifatida qoladi — bu POS-2/POS-3da
  frontend-dev tomonidan tasdiqlanishi kerak)

## Effort estimation

- Frontend (POS-1, POS-2, POS-3): L — ~3-4 kun (mavjud kodni ulash + bug fix + real qurilmada sinov)
- Frontend/Architect (POS-4): S-M — ~0.5-1 kun (qaror + agar kerak bo'lsa kichik wiring)
- Total: ~4-5 kun

## Tickets

- `POS-1-barcode-input-conflict-fix.md` — frontend-dev (depends: none)
- `POS-2-receipt-printing-checkout-wiring.md` — frontend-dev (depends: none, POS-1 bilan parallel)
- `POS-3-cash-drawer-and-bt-device-filter.md` — frontend-dev (depends: POS-2)
- `POS-4-mobile-scale-parity-decision.md` — frontend-dev (depends: none, barchasi bilan parallel)
