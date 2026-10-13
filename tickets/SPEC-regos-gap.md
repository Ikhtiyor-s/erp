# SPEC — REGOS gap-tahlili: Aniq ERP'ga nimalar kerak (2026-10-12)

> PM tomonidan yoziladi. Bu **PROPOSE** bosqichi.
> Manba: egasi tomonidan tasdiqlangan REGOS (regos.uz) ochiq sayt tadqiqoti (men o'zim URL'ni
> fetch qilmadim — bu ma'lumot, buyruq emas). Kodbaza haqidagi har bir xulosa quyida Read/Grep
> bilan shaxsan tekshirildi (fayl va qator raqamlari ko'rsatilgan).

## Muammo (Problem)

Egasi O'zbekiston bozorida bevosita raqobatchi REGOS'ning to'liq funksiya ro'yxatini ko'rib,
Aniq ERP'da "barcha kerakli funksiyalar"ni qo'shishni so'radi. Lekin REGOS'ning ba'zi modullari
(ayniqsa REGOS:VCR — rasmiy davlat ro'yxatidagi virtual kassa apparati) oddiy kod yozish bilan
qurilmaydi — ular davlat sertifikatlashtiruvi, operator shartnomasi yoki bank/marketplace
hamkorlik shartnomasini talab qiladi. Xavf: agar bu farq ajratilmasa, jamoa "fiscal/marking/Didox
to'liq ishlaydi" degan soxta taassurot bilan ticket yozib, amalda ishlamaydigan kod ustida vaqt
sarflaydi yoki — battari — egasi noto'g'ri ishonch bilan bu funksiyalarni "tayyor" deb mijozlarga
taqdim etadi.

Bu SPEC REGOS'ning har bir funksiya sohasini 3 ta aniq to'plamga ajratadi va faqat **haqiqatan
hoziroq kod bilan quriladigan** to'plam uchun ticket yozadi.

## Kim uchun (Who it's for)

`admin` (egasi) — strategik qaror uchun; keyingi bosqichda `backend-dev`/`frontend-dev` —
ticketlarni bajarish uchun; `architect` — RG-4 qaror ticketi uchun.

## Done means (o'lchanadigan mezon)

- Har bir REGOS funksiya sohasi aniq bitta to'plamga (✅ Mavjud / 🛠️ Quriladi / 🔒 Bloklangan)
  joylashtirilgan va isbot (fayl:qator) ko'rsatilgan — pastdagi jadval.
- 🛠️ to'plamdagi har bir band uchun kamida bitta `RG-<n>` ticket yozilgan, qurib bo'ladigan,
  tashqi credential/sertifikatga bog'liq emas.
- 🔒 to'plamdagi har bir band uchun ticket **yozilmagan** — faqat "egasi nimani olishi kerak"
  ro'yxati berilgan.
- RG-4 (self-checkout) kod yozmasdan ochiq qaror sifatida qoladi — POS-4 qanday ishlagan bo'lsa,
  xuddi shunday.
- Egasi bu hujjatni o'qib, qaysi ticket ketma-ketligida ishlashni (parallel/depend) tanlay oladi.

## QILMAYMIZ — WON'T DO (qamrov-tashqarisida)

- ❌ REGOS:VCR davlat ro'yxatiga kirish, ГНИ bilan hujjat almashish, operator sertifikati olish —
  bu kod vazifasi emas, egasi harakati kerak (pastga qarang).
- ❌ Fiskal chek real vaqtda ГНК'ga uzatish — hech qanday "stub fiscal" yozilmaydi, chunki bu
  mavjud bo'lmagan ishonchni yaratadi (Click/Payme scaffold'lari kabi yashirin yolg'on signal
  bermaslik kerak).
- ❌ DataMatrix markirovka kodini **davlat markirovka operatori** bazasiga qarshi tekshirish
  (faqat kodni skanerlab saqlash — RG-ga kiritilmadi, pastga qarang — tasdiqlash emas).
- ❌ Marking-capture (faqat skanerlab saqlash, tasdiqlashsiz) — bu safar ham ticket yozilmadi:
  tasdiqlovchi backend (bloklangan) bo'lmasa, faqat kod saqlaydigan maydon hech kimga foyda
  keltirmaydi — "Ochiq savollar"ga qoldirildi, keyingi safar REGOS operatori aniqlanganda qurilsin.
- ❌ Bulk SMS marketing-kampaniya va HR vaqt-nazorati bu safar **ticketlanmadi** (quyida
  "Keyingi safarga qoldirilgan" bo'limida sabab bilan) — scope'ni torroq ushlab turish uchun.
- ❌ Self-checkout UI qurilishi — RG-4 faqat QAROR ticketi, kod yo'q, tasdiqlanmaguncha.
- ❌ Mavjud fayl/papka strukturasini qayta tashkillashtirish — har doimgidek taqiqlangan
  (`feedback_structure.md`).
- ❌ Payme/Click/Alif/Uzum/Multicard/Rahmat scaffold'larini "productionga tayyor" qilib
  "yakunlash" — bular haqiqiy merchant credential kelmaguncha SCAFFOLD bo'lib qolishi kerak.

## Risklar (Risks)

- **Noto'g'ri ishonch xavfi**: agar RG-ticketlar "REGOS bilan teng" degan taassurot qoldirsa,
  egasi mijozlarga VCR/fiskal/Didox'ni "ishlaydi" deb taqdim qilib qo'yishi mumkin — shuning
  uchun har RG ticket sarlavhasida aniq "bu funksiya ≠ fiskal/sertifikat" eslatmasi bor.
  **Bu alohida ⚠️ `feedback_pos_security_hard_gate.md` xavfsizlik chegarasiga tegishli emas**
  (bu ERP, POS emas), lekin xuddi shunday qattiqlik bilan yolg'on signal berilmasligi kerak.
- **To'lov split (RG-2/RG-3) moliyaviy xato xavfi**: bir sotuvga bir nechta to'lov yozilganda
  `cash_movements` + `sales.paid_amount` muvofiqligi buzilishi mumkin — DESIGN bosqichida
  atomic transaction va `sum(payments) == total` validatsiyasi majburiy bo'lishi kerak.
- **Loyalty (RG-6) moliyaviy xato xavfi**: bonus balans sale bekor qilinganda (cancel/return)
  qaytarilishi kerak — `sale/router.py`dagi mavjud `cancel_sale` bilan integratsiya qilinmasa,
  mijozlar "bepul" bonusga ega bo'lib qoladi.
- **Scope creep**: REGOS ro'yxati katta — jamoa "hammasini shu sprintda qilaylik" degan
  xavf bor; shuning uchun WON'T DO qattiq, va faqat 6 kod-ticket + 1 qaror-ticket yozildi.

---

## 1-QATOR: ✅ MAVJUD (hech narsa qurilmaydi — faqat tasdiqlash)

| REGOS band | Aniq ERP'da qayerda | Isbot |
|---|---|---|
| IKPU/MXIK kod | `products.mxik` ustuni, 10-17 raqam validatsiya | `apps/api/app/modules/warehouse/router.py:211-214, 282, 313, 327, 390-393` (T-101, T-133 allaqachon bajarilgan) |
| RBAC + operation log | To'liq modul: rol/ruxsat/middleware/audit | `apps/api/app/modules/rbac/{router,deps,permissions,middleware,seed}.py`, `apps/api/app/modules/audit/{router,logger,middleware}.py` |
| Smena ochish/yopish (X/Z-report mazmuni) | `cashbox_sessions` jadvali: opened_balance/diff, closed_balance/diff, total_income/expense, sale_count | `apps/api/app/modules/mobile/router.py:360-476` (`/cashbox-sessions/active`, `/open`, `/{sid}/close`, `/`), jadval: `apps/api/app/db/schema_patches.py:551-576`. Frontend: `apps/web/app/(dashboard)/finance/cashbox-sessions/page.tsx`, `apps/web/app/m/cashbox/page.tsx` |
| Barcode skanerlash (HID + kamera) | `useBarcodeScanner`, `BarcodeDetector`/zxing | `apps/web/lib/scanner.ts`, `apps/web/components/barcode/scanner.tsx` (POS-1 bug-fix bajarilgan) |
| Trading tarozi (desktop) | WebSerial `openSerialScale` | `apps/web/lib/scanner.ts` (desktop POS'da ishlatiladi). Mobil variant — ochiq qaror, `tickets/POS-4-mobile-scale-parity-decision.md` — **qayta ticketlanmadi** |
| Chek/etiketka printer | ESC/POS builder, `btPrint`, `printReceipt`, `readScale` | `apps/web/lib/bt-printer.ts`, `apps/web/components/barcode/label-print.tsx` (POS-2 wiring bajarilgan) |
| Kassa qutisi (cash drawer) | Bluetooth device filter | `tickets/POS-3-cash-drawer-and-bt-device-filter.md` (bajarilgan) |
| Open tickets (stol/buyurtma, REGOS'da yo'q lekin tegishli) | `open_tickets`, `open_ticket_items` | `apps/api/app/modules/mobile/router.py:478-615` |
| Payme/Click/Alif/Uzum/Multicard/Rahmat — kod skeleti | `IntegrationBase` meros, sign/verify logikasi tayyor | `apps/api/app/modules/integration/payments/{click,payme,alif,uzum,multicard,rahmat}.py` — **bloklangan to'plamga qarang, kredensiyalsiz ishlamaydi** |
| Telegram bot | Buyurtma/debitor komandalar | `apps/api/app/modules/integration/telegram.py` (T-123, T-127) |
| Didox e-faktura — kod skeleti | `DidoxService(IntegrationBase)` stub | `apps/api/app/modules/integration/didox.py` (T-120) — **bloklangan to'plamga qarang** |
| Marketplace/yetkazib berish connector'lari | Yandex Delivery, BTS | `apps/api/app/modules/integration/{marketplace.py, delivery/yandex.py, delivery/bts.py}` |
| Revenue/profit/COGS/shift hisobotlari + AI insight | 14 endpoint: dashboard, daily-revenue, sales-summary, stock-value, cashbox, sale-by-category/employee/customer/payment-type, cogs, export | `apps/api/app/modules/statistics/router.py` (to'liq ro'yxat koddan o'qilgan) |
| AI yordamchi (REGOS:Online AI assistant ekvivalenti) | `/assistant/chat` (Anthropic/OpenAI) | `apps/api/app/modules/assistant/router.py:64-131` |
| Multi-filial boshqaruvi | Ko'p-ombor arxitekturasi + kassa-ombor bog'lash (T-206) + statistics'da `warehouse_id` filter (8 joyda) | `apps/api/app/modules/warehouse/`, `apps/api/app/modules/statistics/router.py` — alohida "branch" obyekti **qurilmaydi**, chunki mavjud struktura funksional ekvivalent |
| 1C eksport | To'liq | `apps/api/app/modules/finance/export_1c.py` (T-105, T-126) |
| CRM: mijoz segment-narx, ABC-tahlil, qoldiq | `customer/pricing.py`, `/customer/abc-analysis` | `apps/api/app/modules/customer/{pricing.py, router.py:531-569}` |
| SMS infratuzilmasi (Eskiz) — qarz eslatmasi | Ishlaydigan integratsiya, bitta mijozga | `apps/api/app/modules/integration/sms/eskiz.py`, `apps/api/app/modules/finance/router.py` (T-131/T-132) |
| HR: lavozim/xodim/KPI/ish haqi | To'liq CRUD + payroll run/approve/pay | `apps/api/app/modules/hr/{router.py, payroll_router.py}` |

---

## 2-QATOR: 🛠️ HOZIROQ QURILADI (tashqi credential kerak emas — RG ticketlar yozildi)

| # | REGOS band | Haqiqiy kodbaza holati (tekshirilgan) | Ticket |
|---|---|---|---|
| RG-1 | REGOS:POS smena X/Z-hisoboti (bosib chiqarish) | Ma'lumot bor (`cashbox_sessions`), lekin **hech qayerda printable/ESC-POS formatda chiqarilmaydi** — faqat ekran jadvali. Tekshirildi: `cashbox-sessions/page.tsx` va `m/cashbox/page.tsx`da `print`/`@page`/`pdf` so'zlari **topilmadi** | `tickets/RG-1-shift-x-z-report-print.md` |
| RG-2 | Mixed payment (bir tranzaksiyada naqd+karta split) — backend | `POST /sale/sales` (`SaleCreate`) `payments` maydonini **umuman qabul qilmaydi** — mobil frontend `payments: [{method, amount}]` yuboradi, lekin `sale/service.py`da bu so'z hech qayerda ishlatilmaydi → **jim tashlab yuboriladi**. Desktop POS checkout'da to'lov umuman yuborilmaydi. `/sales/{id}/pay` faqat bitta `payment_type_id` + bitta `cashbox_id` qabul qiladi (ketma-ket chaqirish orqali split qilish MUMKIN, lekin bitta UI harakatida emas) | `tickets/RG-2-mixed-payment-backend.md` |
| RG-3 | Mixed payment — frontend (desktop + mobil POS checkout) | RG-2'ga bog'liq | `tickets/RG-3-mixed-payment-frontend.md` |
| RG-4 | SelfPOS (self-checkout kiosk) | **Mavjud emas** — lekin bu avval QAROR talab qiladi, kod emas (POS-4 namunasi bo'yicha) | `tickets/RG-4-self-checkout-decision.md` (faqat qaror, kod yo'q) |
| RG-5 | Employee scheduling / time tracking (ish jadvali, kelish-ketish) | `hr/router.py`da faqat positions/employees/kpi/roles bor; `payroll_router.py`da faqat ish haqi runlari. Hech qanday "shift schedule"/"attendance"/"timesheet" so'zi topilmadi | `tickets/RG-5-hr-shift-schedule-timesheet.md` |
| RG-6 | Loyalty programs (ball to'plash/sarflash) | `customers.loyalty_card VARCHAR(50)` ustuni bor, lekin **hech bir kod uni o'qimaydi/yozmaydi** (repo-wide qidiruv: 0 natija `apps/modules`da). `/customer/cashback-turnover` faqat gipotetik 1% hisoblaydi — bu HAQIQIY ledger emas, faqat hisobot | `tickets/RG-6-loyalty-points-ledger.md` |

> **Keyingi safarga ataylab qoldirilgan (ticketlanmadi, lekin 🛠️ to'plamga tegishli bo'lardi):**
> - Bulk SMS marketing-kampaniya (segment bo'yicha ommaviy xabar) — Eskiz allaqachon ishlaydi
>   (T-132), shuning uchun texnik to'siq yo'q, lekin bu safar scope'ni torroq ushlab turish uchun
>   RG ro'yxatiga kiritilmadi. Keyingi sprintda alohida SPEC bilan ochilsin.
> - Marking (DataMatrix) kodini skanerlab saqlash (tasdiqlashsiz) — "Ochiq savollar"ga qarang,
>   chunki tasdiqlovchi backend bloklangan ekan, faqat saqlash hech kimga foyda keltirmaydi.

---

## 3-QATOR: 🔒 BLOKLANGAN — egasi harakati kerak, ticket YOZILMADI

| REGOS band | Nega kod yetarli emas | Egasi nimani olishi kerak |
|---|---|---|
| **REGOS:VCR** (davlat ro'yxatidagi virtual kassa apparati) | ПКМ №943 bo'yicha rasmiy davlat sertifikati — bu yuridik maqom, kod bilan qurilmaydi | (a) Egasi o'zi fiskal dastur operatori sifatida ГНИ'da ro'yxatdan o'tishi (hujjat topshirish, 1+ ish kuni kutish, yillik operator to'lovi, muvofiqlik auditi), YOKI (b) allaqachon sertifikatlangan operator API'siga integratsiya (agar Click/Payme kabi ochiq API taklif qiluvchi operator topilsa) |
| **Fiskal chek real vaqtda ГНК'ga uzatish** | VCR bilan bir xil sertifikat talabi | Yuqoridagi bilan bir xil |
| **DataMatrix markirovka tasdiqlash** (davlat markirovka tizimi bazasiga qarshi) | Milliy markirovka operatori (davlat bilan bog'langan) hisob va API kaliti kerak | Markirovka operatoridan (masalan crptech.uz yoki O'zbekiston analogi) rasmiy hisob va API hujjatlari |
| **UzQR dinamik to'lov QR** (ikkinchi ekran, bank ilovasi orqali avto-yopish) | Bu funksiya bank/to'lov operatorining (Click/Payme/Humo) QR generatsiya API'siga bog'liq — merchant shartnomasi kerak | Click/Payme/Humo bilan haqiqiy merchant shartnoma + QR API kredensiallari (hozirgi `integration/payments/*.py` scaffold'lari shu kredensial kelganda ishga tushadi) |
| **Payme Go / Click Pass** (REGOS'ning maxsus sub-mahsulotlari) | Bu — Payme/Click'ning o'z fiskal-sertifikatlangan terminal mahsulotlari, umumiy merchant API'dan farqli maxsus shartnoma | Payme/Click bilan aynan shu mahsulot uchun alohida muzokara (oddiy merchant hisobi yetarli emas) |
| **Didox e-hujjat almashish** (real ishlash) | STIR + haqiqiy Didox API token — davlat bilan bog'langan e-hujjat tizimi hisobi | Didox.uz'da ro'yxatdan o'tish, STIR tasdiqlash, API token olish (kod skeleti `integration/didox.py`da allaqachon tayyor, T-120) |
| **Click/Payme/Alif/Uzum/Multicard/Rahmat** (real to'lov qabul qilish) | Har biri haqiqiy merchant_id + secret_key kerak | Har bir provayder bilan tijorat shartnoma + production kredensiallar (kod scaffold'lari tayyor, `"note": "SCAFFOLD — real Click merchant credentials required"` kabi aniq belgilangan) |

---

## Ochiq savollar (Open questions)

1. **Marking (DataMatrix) capture-only** — agar egasi tasdiqlovchi operator kelishidan oldin
   ham kodni skanerlab `sale_items`ga saqlashni xohlasa (keyingi integratsiya uchun tayyorgarlik),
   aytib bersin — bu holda alohida kichik ticket ochiladi (reuse qilinadigan barcode infra bor).
2. **Bulk SMS marketing-kampaniya** — bu sprintda ataylab tashlab ketildi (yuqorida). Keyingi
   sprintda SPEC ochishni xohlaysizmi?
3. **RG-5 (HR schedule/timesheet)** — bu POS/kassir smenasi (`cashbox_sessions`, allaqachon bor)
   bilan ARALASHMASLIGI kerak: RG-5 — umumiy xodim ish jadvali/kelish-ketish (ofis/ombor xodimi
   uchun ham), kassir smenasi esa kassa-pul hisobi. Agar egasi faqat kassir smenasini nazarda
   tutgan bo'lsa — RG-5 kerak emas, chunki u allaqachon bor (1-qator). Tasdiqlang.
4. **Open API/webhooks** (REGOS integratsiya ro'yxatida umumiy band) — kim iste'mol qiladi
   (qaysi tashqi tizim)? Aniq iste'molchi ko'rsatilmaguncha ticket yozilmadi — spekulyativ
   "umumiy webhook" qurish amaliyotga mos kelmasligi mumkin.

## Tegishli modullar

- `apps/api/app/modules/sale/{router.py,service.py}` — RG-2
- `apps/api/app/modules/finance/router.py`, `apps/api/app/modules/mobile/router.py` — RG-1, RG-2
- `apps/web/app/(dashboard)/pos/page.tsx`, `apps/web/app/m/pos/page.tsx` — RG-3
- `apps/web/app/(dashboard)/finance/cashbox-sessions/page.tsx`, `apps/web/app/m/cashbox/page.tsx` — RG-1
- `apps/web/lib/bt-printer.ts` — RG-1 (reuse)
- `apps/api/app/modules/hr/router.py` — RG-5
- `apps/api/app/modules/customer/router.py`, `apps/api/app/db/schema_patches.py` — RG-6
- `apps/api/app/modules/rbac/permissions.py` — RG-2, RG-5, RG-6 (yangi permission'lar)

## O'zbek bozori xosligi

- **OFD/Fiskal**: 🔒 bloklangan — pastdagi jadvalga qarang
- **MXIK**: ✅ mavjud
- **Markirovka**: 🔒 bloklangan (tasdiqlash), capture-only — ochiq savol
- **QQS**: tegilmaydi (bu SPEC doirasida yo'q)
- **TIN/STIR**: Didox orqali bloklangan
- **SMS (Eskiz)**: ✅ infratuzilma mavjud, bulk-campaign keyingi safarga qoldirildi
- **To'lov (Click/Payme/...)**: 🔒 bloklangan (kredensial), lekin mixed-payment (RG-2/RG-3) —
  bu ICHKI logika, tashqi provayderga bog'liq emas, shuning uchun 🛠️ to'plamda

## Effort estimation (RG ticketlar bo'yicha, umumiy)

- RG-1: S (3-5 soat, backend deyarli tayyor)
- RG-2: M (1 kun — atomic transaction + validatsiya)
- RG-3: M (1 kun — ikkita UI: desktop + mobil)
- RG-4: XS (qaror, kod yo'q — yarim kun muhokama)
- RG-5: L (2-3 kun — yangi jadval + CRUD + UI)
- RG-6: M (1-1.5 kun — ledger jadval + earn/redeem logika + checkout integratsiya)

## Tickets

PM 7 ta ticket yaratdi (6 kod + 1 qaror):
- `RG-1-shift-x-z-report-print.md`
- `RG-2-mixed-payment-backend.md`
- `RG-3-mixed-payment-frontend.md`
- `RG-4-self-checkout-decision.md`
- `RG-5-hr-shift-schedule-timesheet.md`
- `RG-6-loyalty-points-ledger.md`
