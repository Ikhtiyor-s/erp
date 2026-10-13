# SPEC — POS: Offline-rezilientlik — kerak yoki shart emas? (2026-10-12)

> PM tomonidan yoziladi. Bu **PROPOSE** bosqichi.
> Diqqat: bu SPEC ataylab `tickets/SPEC-pos-hardware.md`dan ALOHIDA chiqarilgan. Sabab: hardware
> spec'dagi ish — "mavjud, sinalgan naqshni ulash" (past risk, aniq effort). Bu spec — "butunlay yangi
> arxitektura kerakmi yoki yo'qmi" degan OCHIQ savol (yuqori noaniqlik, noto'g'ri qaror qilish narxi
> yuqori — Biznes POS'ning o'z tajribasi buni isbotlaydi, pastda ko'ring). Shuning uchun bu spec'ning
> birinchi ticketi — ARXITEKTOR SPIKE, kod yozish emas. Ticket prefiks: `POS-5`, `POS-6`
   (hardware spec'dagi `POS-1`..`POS-4` bilan bir xil raqamlash fazosida, lekin mustaqil ishlaydi).

## Niyat (1 abzats)

Biznes POS (restoran floor POS, sister-loyiha) `packages/offline-sync`da to'liq IndexedDB-asosida
offline-first navbat+sync arxitekturasini qurgan (`offlineStore`, `syncQueue`, `syncEngine`,
`networkDetector`) — restoran stolida Wi-Fi uzilib qolsa ham buyurtma yo'qolmasligi uchun. Savol:
Aniq ERP'ning POS ekrani (`apps/web/app/(dashboard)/pos/page.tsx`) — oddiy do'kon kassasi, bitta
bosqichli "skanerla → savat → to'la" oqimi, Next.js dashboard ichida, hech qanday offline-tolerant
app shell/service worker'siz — xuddi SHU darajadagi investitsiyani talab qiladimi? Hozircha
`checkout()` to'g'ridan-to'g'ri `/sale/sales`ga `POST` yuboradi, muvaffaqiyatsiz bo'lsa faqat
`toast.error` ko'rsatadi — na retry, na navbat, na duplicate-himoya. **Muhim ogohlantirish**: Biznes
POS'ning o'zida ham bu investitsiya ishlamayapti — uning haqiqiy "buyurtma qo'sh" tugmasi
(`zal-pos/src/pages/POS/screens/POSInterface.tsx:1246,1355,1428`) `posPaymentService.createOrder()`ni
chaqiradi, offline-safe `orderApiService`/`offlineOrderService` yo'lini EMAS — ya'ni qurilgan
offline-sync Biznes POS'ning o'z eng muhim amalini bugun himoya qilmaydi. Bu — "nufuzli namuna" deb
ko'r-ko'rona ko'chirishning real narxini ko'rsatuvchi dalil.

## Tegishli foydalanuvchi

- **Asosiy**: `kassir` — internet/server bilan aloqa uzilganda ham sotuvni yo'qotmasligi kerak
  bo'lgan shaxs
- **Ikkinchi darajali**: `admin` — agar to'liq offline arxitektura tanlansa, shu holatni kuzatish/
  nazorat qilish (masalan "N ta sinxronlanmagan sotuv" indikatori)

## Acceptance criteria (Given/When/Then)

**Scenario 1: Arxitektura qarori — spike natijasi**
- **Given** POS-5 arxitektor tadqiqoti tugagan
- **When** DESIGN hujjati chiqadi
- **Then** aniq, yozma qaror bitta variantni tanlaydi: (A) hech narsa qilinmaydi (hozirgi holat
  yetarli), (B) yengil chora — idempotency-key + mahalliy retry navbati (faqat `checkout()` amali
  uchun), (C) to'liq offline-first — Biznes POS naqshiga o'xshash IndexedDB queue+sync — va HAR
  BIR variant uchun nega tanlangani/rad etilgani yozilgan (taxmin emas)

**Scenario 2 (agar B yoki C tanlansa): Tasodifiy ikki marta yuborish himoyasi**
- **Given** kassir "Оплатить" tugmasini ikki marta tez ketma-ket bosadi (tarmoq sekin javob
  berayotganda) YOKI tarmoq uzilib, brauzer avtomatik qayta so'rov yuboradi
- **When** ikkinchi so'rov serverga yetib boradi
- **Then** faqat BITTA `sales` yozuvi yaratiladi — ikkinchi so'rov birinchisining natijasini qaytaradi,
  ombordan ikki marta ayirib tashlanmaydi

**Scenario 3 (agar C tanlansa): To'liq offline rejim**
- **Given** kassir qurilmasi internetdan butunlay uzilgan
- **When** kassir mahsulot skanerlaydi va "to'la"ni bosadi
- **Then** sotuv mahalliy IndexedDB navbatiga yoziladi, kassirga "offline, keyinroq sinxronlanadi"
  ko'rsatiladi, internet qaytganda avtomatik serverga yuboriladi — DUPLIKATSIZ (Biznes POS'ning
  `offline-order-service.ts`dagi `isDuplicate`/`markSynced`/`resolveServerId` naqshi)

**Scenario 4: Biznes POS'ning dual-path xatosi TAKRORLANMAYDI**
- **Given** qaysi variant tanlanishidan qat'i nazar, implementatsiya bosqichida
- **When** POS ekranining HAQIQIY "to'la" tugmasi ulanadi
- **Then** u variant B/C'ning offline-safe/idempotent yo'liga ulanadi — Biznes POS'dagi kabi
  ikkinchi, himoyalanmagan "shortcut" yo'l YARATILMAYDI (kod review'da aniq tekshiriladi: bitta
  checkout-chaqiruv joyi, ikkinchisi yo'q)

## Talablar (RFC 2119)

- **MUST**: Hech qanday offline-sync kod yozishdan OLDIN POS-5 arxitektor qarori yozma shaklda
  tasdiqlanishi shart — bu spec implementatsiya ketma-ketligini OLDINDAN belgilamaydi
- **MUST**: Qaysi variant tanlanmasin, POS ekranida faqat BITTA sotuv-yaratish chaqiruv yo'li
  bo'lishi shart (Biznes POS'dagi ikki-yo'l xatosiga qarshi muhofaza)
- **MUST**: Agar variant B (idempotency-key) tanlansa — bu allaqachon shu repo'da avval
  SPEC'LANGAN, lekin HECH QACHON QURILMAGAN `tickets/T-208-idempotency-key-middleware.md`
  ticketining qayta tiklanishi/moslashtirilishi bo'ladi (tasdiqlangan: `apps/api/app/core/
  idempotency.py` mavjud emas, `sale/router.py`da `Idempotency-Key` header ishlatilmaydi) — bu
  ticket NOLDAN emas, mavjud dizayndan boshlanadi
- **MUST NOT**: Variant C tanlansa ham, Biznes POS'ning `packages/offline-sync`ini NPM paket
  sifatida yoki xom nusxa sifatida to'g'ridan-to'g'ri import qilib bo'lmaydi — u `@biznes/*`
  monorepo workspace'ga bog'liq va Vite/React-Router asosidagi `zal-pos`ga mo'ljallangan (Aniq
  ERP — Next.js); faqat MANBA fayllar (`offline-store.ts`, `sync-queue.ts`, `sync-engine.ts`,
  `network-detector.ts`) naqsh sifatida o'qilib, Aniq ERP'ning UUID-string mahsulot/sotuv modeliga
  moslashtirilgan holda `apps/web/lib/offline/`ga qayta yozilishi mumkin
- **SHOULD**: Qaror qabul qilishda quyidagi savolga aniq javob berilsin: Aniq ERP POS ekrani
  Next.js dashboard ichida joylashgan (login talab qiladi, service worker/PWA shell yo'q) — demak
  internet butunlay uzilganda KASSIR SAHIFANING O'ZINI HAM OCHA OLMAYDI (agar u avval ochilgan/
  keshlangan bo'lmasa). Shuning uchun "to'liq offline" foydasi cheklangan bo'lishi mumkin — variant
  tanlovida bu aniq hisobga olinishi kerak, ignored qilinmasligi kerak
- **MAY**: Variant C tanlansa, `vite-plugin-pwa`ga o'xshash Next.js PWA/service-worker qatlami ham
  kerak bo'lishi mumkin — bu alohida, katta qo'shimcha effort, POS-5 buni aniq ajratib ko'rsatishi
  kerak (ya'ni "C" aslida ikki qism: C1=sync queue, C2=offline app-shell)

## QILMAYMIZ (qamrov-tashqarisida)

- ❌ POS-5 qarori chiqmasdan turib HECH QANDAY implementatsiya kodi yozilmaydi — bu spec'ning eng
  qattiq cheklovi
- ❌ Biznes POS'ning `packages/offline-sync`ini "shunchaki ko'chirib qo'yish" — yuqorida Talablar
  qismida izohlangan sabablarga ko'ra MUST NOT
- ❌ Restoran-POS'ga xos tushunchalar (stol holati `tableId`/`OCCUPIED`, oshxona ekrani `kitchen
  orders`, yarim-yarim pitsa modifikatorlari) — Aniq ERP POS chakana savdo, bular umuman tegishli
  emas, ko'chirilmaydi
- ❌ Multi-device LAN hub/local-server-discovery (`server-discovery.ts`, `enableLanDiscovery`) —
  Biznes POS'da ham hali "hub funksiyasi qurilmagan" deb izohlangan eksperimental qism, bu safar
  ko'rib chiqilmaydi
- ❌ Variant C tanlansa ham, bu sprintda to'liq Service Worker/PWA app-shell QURILMAYDI — agar
  kerak bo'lsa, POS-5 buni alohida, kelajakdagi spec sifatida belgilaydi (yuqoridagi C2)

## Rollback rejasi

- **POS-5 (spike)**: faqat hujjat, rollback kerak emas
- **POS-6 (agar variant B)**: `apps/api/app/core/idempotency.py` yangi, mustaqil modul — o'chirish =
  middleware'ni `main.py`dan unregister qilish, `idempotency_keys` jadvali bo'sh qolsa ham zararsiz
  (DROP TABLE xavfsiz, hech qanday boshqa jadval bog'lanmagan)
- **POS-6 (agar variant C)**: frontend-only (`apps/web/lib/offline/`), backend'ga tegmaydi —
  o'chirish = import'larni olib tashlash, `checkout()` eski to'g'ridan-to'g'ri `POST` yo'liga qaytadi

## Tegishli modullar

- `apps/web/app/(dashboard)/pos/page.tsx` — `checkout()` (161-188) — yagona o'zgarish nuqtasi
  (Talablar: MUST — bitta yo'l)
- `apps/api/app/modules/sale/router.py` — `POST /sale/sales` — agar variant B, shu yerga
  idempotency decorator qo'shiladi
- `tickets/T-208-idempotency-key-middleware.md` — MAVJUD, QURILMAGAN spike/dizayn manbai (variant B
  tanlansa, bu ticket "qayta ochiladi", noldan yozilmaydi)
- Referens (ko'chirilmaydi, faqat o'qiladi): `D:\Docker\projects\pos\packages\offline-sync\src\*.ts`,
  `D:\Docker\projects\pos\apps\zal-pos\src\pages\POS\screens\POSInterface.tsx` (dual-path xato joyi)

## O'zbek bozori xosligi

- **OFD**: ✗ tegmaydi — lekin eslatma: agar kelajakda OFD (fiskal) integratsiyasi qo'shilsa, OFD
  odatda REAL-TIME serverga bog'lanishni talab qiladi, bu "to'liq offline sotuv" tushunchasini
  tubdan qiyinlashtiradi — POS-5 shu nuqtani ham eslatma sifatida qayd etsin
- **MXIK/QQS/TIN/SMS**: ✗ tegmaydi
- **To'lov**: ✗ tegmaydi bu safar — ammo variant C tanlansa, offline-da naqd-bo'lmagan to'lov
  (karta/QR) odatda imkonsiz (terminal ham online bo'lishi kerak) — shuning uchun "offline checkout"
  faqat naqd to'lov uchun ma'noga ega, bu POS-5da aniq yozilsin

## Risklar

- Eng katta risk — **noto'g'ri variant tanlash narxi yuqori**: agar C (to'liq offline) tanlansa va
  keyin chiqsa-ki real foydalanuvchilarda internet uzilishi deyarli bo'lmaydi (oddiy do'kon, doim
  online), bu haftalab behuda investitsiya bo'ladi — Biznes POS'ning o'z holati buni isbotlaydi
  (qurilgan, lekin asosiy tugmaga ulanmagan)
- Agar A (hech narsa qilinmaydi) tanlansa — takroriy POST (ikki marta bosish/tarmoq retry) hali ham
  duplicate sotuv xavfini qoldiradi; bu eng kam effort, lekin eng kam himoya variant
- Variant B eng arzon/eng kam riskli ko'rinadi (mavjud T-208 dizaynidan foydalanadi, backend-only,
  frontend minimal o'zgarish) — ammo PM sifatida buni MAJBURIY tavsiya qilmayapman, chunki bu
  arxitektura qarori, final so'z architect/inson tasdig'iga qoldirilishi kerak

## Ochiq savollar

- Aniq ERP'ning haqiqiy mijozlari (kichik/o'rta chakana do'konlar) qancha tez-tez internet
  uzilishini boshdan kechiradi? Bu spec yozilayotganda bu ma'lumot yo'q — taxmin qilinmadi,
  POS-5 spike qismida so'ralishi/tekshirilishi kerak (mijoz fikri yoki support so'rovlari orqali)
- Agar variant C tanlansa — Next.js'da service worker/offline app-shell qo'shish butunlay boshqa,
  katta ko'lamli loyiha bo'lib ketadi (hozirgi dashboard arxitekturasiga ta'sir qiladi) — bu
  SPEC doirasidan tashqarida qolishi mumkin, POS-5 buni aniq chegaralashi kerak

## Effort estimation

- Architect (POS-5): S — ~0.5-1 kun (spike + DESIGN yozish, kod yo'q)
- Backend/Frontend (POS-6): **noma'lum, POS-5 natijasiga bog'liq** — variant A: 0; variant B: S
  (~1-2 kun, T-208 asosida); variant C: XL (~1-2 hafta, to'liq port+moslashtirish+test)
- Total: POS-5 tugagunча aniqlanmaydi (bu ataylab — noaniqlikni soxta raqam bilan yopmaslik)

## Tickets

- `POS-5-offline-resilience-design-spike.md` — architect (depends: none)
- `POS-6-checkout-retry-safety-implementation.md` — backend-dev + frontend-dev (depends: POS-5 —
  qamrovi POS-5 natijasiga qarab belgilanadi)
