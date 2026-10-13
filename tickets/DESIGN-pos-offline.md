# DESIGN — POS-5: Aniq ERP POS'ga offline-rezilientlik kerakmi? (spike natijasi)

> Architect tomonidan yoziladi. Bu **kod yozilmagan** spike — qaror hujjati.
> SPEC: `tickets/SPEC-pos-offline.md`. Ticket: `tickets/POS-5-offline-resilience-design-spike.md`.
> Bu hujjat API-kontrakt muzlatmaydi (bu safar kod yo'q) — u **arxitektura qarorini** muzlatadi:
> POS-6 qamrovi shu qarordan kelib chiqadi va loyiha egasi tasdiqlagandan keyin o'zgarmaydi.

## YAKUNIY QAROR: **Variant B** — Idempotency-Key + mahalliy (bitta urinish ichidagi) qayta urinish

Variant A (hech narsa) rad etildi — takroriy POST xavfi (ikki marta bosish/tarmoq-darajasidagi
avtomatik retry) hozir HAQIQIY va himoyasiz. Variant C (to'liq offline-first) rad etildi — bu
daraja investitsiyani oqlaydigan real talab/dalil yo'q, va Biznes POS'ning o'z tajribasi buning
narxini isbotlagan (pastda batafsil). **B tanlandi**, chunki backend qismi bu repo'da ALLAQACHON
qurilgan va test qilingan (T-208 "qayta ochish" emas — aslida faqat **frontend ulash** kerak).

---

## 1. Kod bazasida tasdiqlangan haqiqiy holat (taxmin emas)

### Backend — idempotency middleware ALLAQACHON ishlaydi

- `apps/api/app/modules/idempotency/middleware.py` — `IdempotencyMiddleware` mavjud, to'liq
  ishlaydigan holatda: `Idempotency-Key` header, org-scoped izolatsiya, `request_hash` orqali
  konflikt tekshiruvi (409 agar bir xil key boshqa body bilan), 2xx response cache, TTL cleanup.
- `app.add_middleware(IdempotencyMiddleware)` — `apps/api/app/main.py:96` — ro'yxatdan o'tgan.
- `idempotency_keys` jadvali — `apps/api/app/db/schema_patches.py:1546` — `CREATE TABLE IF NOT
  EXISTS`, unique index `(organization_id, idempotency_key)`, `expires_at` indeks.
- **`POST /api/v1/sale/sales` whitelist'da ALLAQACHON BOR** —
  `middleware.py:31` (`_WHITELIST`). Ya'ni POS checkout endpointi backend tomonda bugun ham
  idempotency-himoyalangan — agar client header yuborsa.
- `apps/api/tests/test_idempotency.py` — aynan `/api/v1/sale/sales` ustida test qilingan
  (concurrent-request holati ham, xat-batafsillik: bir xil key bilan race → faqat bitta yozuv).

**Xulosa**: T-208'ning backend qismi — DB jadval, middleware, whitelist, test — **de-facto
bajarilgan**. POS-6 uchun "T-208'ni qayta tiklash" degani endi faqat quyidagi, sof frontend
ishini bildiradi.

### Frontend — ikkala POS checkout() HAM header yubormaydi

- Desktop: `apps/web/app/(dashboard)/pos/page.tsx`, `checkout()` funksiyasi (161-188-qatorlar,
  aniqrog'i 159-188): `api.post("/sale/sales", payload)` — **hech qanday `Idempotency-Key`
  header yo'q**, hech qanday UUID generatsiya qilinmaydi.
- Mobile: `apps/web/app/m/pos/page.tsx`, `checkout()` funksiyasi (122-146-qatorlar):
  xuddi shunday — `api.post("/sale/sales", payload)`, header yo'q.
- Taqqoslash uchun — **aynan shu naqsh repo ichida ikki marta allaqachon qilingan**:
  - `apps/web/lib/shop-api.ts:119-132` (`submitShopCheckout`) — `Idempotency-Key` header bilan.
  - `apps/web/app/(portal)/portal/_components/cart.tsx:53-145` — `newIdempotencyKey()`
    (`crypto.randomUUID()`), bitta `submit()` chaqiruvi ichida tarmoq xatosida (`TypeError` yoki
    `TimeoutError`) **xuddi shu key bilan** qayta urinish.
  
  Demak naqsh yangi ixtiro qilinmaydi — u ikki boshqa checkout oqimida ishlab turgan, faqat
  POS'ga ko'chirilmagan.
- **Double-submit UI himoyasi assimetrik**: mobile POS'da `paying` state bor (`setPaying(true)`
  darhol, tugmalar `disabled={paying || ...}`) — desktop POS'da esa hech qanday loading/disabled
  holati YO'Q (`<Button onClick={checkout}>` — qayta-qayta bosilishi mumkin).
- `apps/api/app/modules/sale/service.py:83` (`create_sale_core`) — client tomonidan yuborilgan
  noyob referens bo'yicha hech qanday dedup tekshiruvi yo'q (faqat warehouse/product org
  tekshiruvi). Ya'ni idempotency-key yo'q holatda (bugungi holat) takroriy POST = ikki alohida
  `sales` yozuvi + ombordan ikki marta ayirish — spec Scenario 2'dagi xavf real.

### Biznes POS referensi — "nufuzli namuna" emas, ogohlantiruvchi dalil

- `D:\Docker\projects\pos\packages\offline-sync\src\offline-order-service.ts`,
  `sync-queue.ts`, `network-detector.ts` — to'liq, yaxshi loyihalangan IndexedDB
  navbat+sync+network-detection arxitekturasi (UUID lokal ID, `isDuplicate`/`markSynced`/
  `resolveServerId`, optimistic-lock `version`, retry+backoff navbat).
- Lekin `apps/zal-pos/src/pages/POS/screens/POSInterface.tsx` (1246, 1355, 1428-qatorlar) —
  haqiqiy "to'lovni tasdiqlash" yo'llarining HAMMASI `posPaymentService.createOrder(payload)`ni
  chaqiradi — offline-safe `offlineOrderService.createOrder()`/sync-queue yo'lini EMAS.
  To'liq offline arxitektura qurilgan, lekin eng muhim tugmaga ulanmagan — **tasdiqlangan**.
- **Nozik, lekin muhim nuans**: shu "shortcut" yo'lning o'zi ham `getNewOrderIdempotencyKey()` /
  `clearNewOrderIdempotencyKey()` chaqiradi (1247, 1356, 1429-qatorlar yonida) — ya'ni Biznes
  POS'ning bugungi real himoyasi aslida **idempotency-key dedup**, C emas! To'liq IndexedDB
  navbat (C) faqat haqiqiy-offline-paytida-buyurtma-yaratish holatini qoplaydi (rare case, hozir
  ishlamaydigan holat) — kundalik "tarmoq sekin/ikki marta bosish" holatini B-uslubidagi
  mexanizm qoplaydi. Bu **B'ning mustaqil qiymatini tasdiqlaydi**: B C qurilmasa ham ishlaydi,
  C esa B'siz (idempotency-key'siz) ham to'liq ishonchli emas edi.

---

## 2. Variantlar — ustunlik/kamchilik (kod-asoslangan)

### Variant A — Hech narsa qilinmaydi

**Ustunlik**:
- Zero effort, zero risk regression.
- Hozirgi POS oqimi (bitta bosqich: skanerla→savat→to'la) oddiy, kam-qadam — xato bo'lsa kassir
  savatni ko'rib, holatni (sotuv yaratilganmi) tekshirib qayta urinishi mumkin (kichik do'konda
  operatorlar odatda bir-ikki kassir, oxirgi sotuvlar ro'yxatini ko'rish qiyin emas).

**Kamchilik**:
- Spec Scenario 2 himoyasiz qoladi: ikki marta bosish/tarmoq-retry = ikkita `sales` yozuvi +
  ombordan ikki marta ayirish — bu moliyaviy/ombor xatosi, qo'lda "sotuvni bekor qilish" orqali
  tuzatiladi (qo'shimcha ish, xato ehtimoli).
- Desktop POS'da tugma hozir disable qilinmaydi — A variantida bu HAM tuzatilmaydi, demak eng
  oson-chaqiriladigan xato yo'li ochiq qoladi.
- "Eng kam himoya" — spec buni to'g'ridan-to'g'ri tan oladi (Risklar bo'limi).

### Variant B — Idempotency-Key + mahalliy retry (faqat `checkout()`)

**Ustunlik**:
- **Backend 95% tayyor** — middleware, jadval, whitelist, test — hammasi mavjud va ishlaydi.
  Qo'shimcha backend kodi SHART EMAS (whitelist'da `/sale/sales` allaqachon bor).
- Frontend qismi kichik va izolatsiyalangan: faqat ikki fayl (`pos/page.tsx`,
  `m/pos/page.tsx`), ikkalasida ham bitta funksiya (`checkout()`) — spec'ning MUST
  talabiga ("bitta chaqiruv yo'li") tabiiy ravishda mos keladi, chunki hech qanday ikkinchi
  yo'l qo'shilmaydi, faqat mavjud yo'lga header+state qo'shiladi.
- Naqsh repo ichida ALLAQACHON isbotlangan (`cart.tsx`, `shop-api.ts`) — yangi noma'lumlik yo'q.
- Spec Scenario 2'ni to'liq yopadi (pastda 4-bo'limda aniq ko'rsatilgan dizayn bilan).
- Scenario 4 (dual-path xato takrorlanmasligi) — B variantida tabiiy ravishda bajariladi, chunki
  yangi "offline-safe alternate path" degan narsa umuman yo'q — faqat BITTA yo'l bor va u
  to'g'ridan-to'g'ri himoyalanadi.
- Effort — SPEC'ning o'z bahosi bilan mos: S (~1-2 kun), aslida backend tayyor bo'lgani uchun
  balki undan ham kamroq (~0.5-1 kun frontend-only).

**Kamchilik**:
- Internet TO'LIQ uzilgan paytda (masalan bir necha daqiqa/soat) kassir hali ham sotuvni
  yakunlay olmaydi — faqat "server javob bermadi" xatosi ko'radi, qo'lda qayta urinadi internet
  qaytganda. B **navbatga qo'ymaydi**, faqat **takroriy yuborishni xavfsiz** qiladi.
- Chegara holat: agar so'rov serverga YETDI va sotuv yaratildi, lekin javob clientga YETMADI
  (haqiqiy uzilish, auto-retry ichki urinish tugagandan keyin ham), va KASSIR QO'LDA yana
  "to'la"ni bossa — bu YANGI `checkout()` chaqiruvi, demak (agar naqsh noto'g'ri qurilsa) yangi
  key bilan haqiqiy duplikat yaratilishi mumkin. **Bu B'ning haqiqiy chegarasi** — pastda
  4-bo'limda bu aniq hal qilinadi (key cart-attempt darajasida saqlanishi, har bosishda emas).

### Variant C — To'liq offline-first (Biznes POS naqshi)

**Ustunlik**:
- Haqiqiy, uzoq muddatli (daqiqalar/soatlar) internet uzilishida ham kassir ishlay oladi —
  agar talab haqiqatan ham shu bo'lsa, yagona to'liq yechim.
- Naqsh (offline-store/sync-queue/sync-engine/network-detector) allaqachon boshqa loyihada
  yozilgan va g'oya darajasida sinalgan — noldan loyihalash kerak emas.

**Kamchilik** (og'irroq, hal qiluvchi):
- **SPEC'ning o'z SHOULD talabi**: Aniq ERP POS — Next.js dashboard ICHIDA, login talab
  qiladi, service worker/PWA app-shell YO'Q. Internet to'liq uzilganda, agar sahifa avval
  ochilib keshlanmagan bo'lsa, kassir **sahifaning o'zini ocha olmaydi** — IndexedDB navbat
  qurilgan bo'lsa ham, unga yetib bo'lmaydi. Demak C1 (faqat sync-queue, app-shell'siz) ning
  real foydasi ERP dashboard kontekstida JUDA CHEKLANGAN — faqat "sahifa ochiq turgan paytda
  internet uzildi" tor holatini qoplaydi, "login qilib ochish kerak bo'lgan" holatni qoplamaydi.
- **Biznes POS'ning o'z dalili**: xuddi shu arxitekturani qurgan loyiha, haqiqiy "to'la" tugmasi
  bilan ULAMAGAN — oylab yozilgan kod asosiy foydalanuvchi amalini bugun himoya qilmaydi. Bu
  "qurish" bilan "haqiqatan ulash" orasidagi farqning real, isbotlangan narxi.
- Naqshni ko'chirib bo'lmaydi (SPEC MUST NOT) — `@biznes/*` workspace'ga, Vite/React-Router'ga
  bog'liq; Aniq ERP — Next.js, UUID-string model farqli. Demak C = **qayta yozish**, "port
  qilish" emas — effort SPEC bahosi bilan mos: XL (~1-2 hafta), bu spike'da taxmin, lekin
  past emas (offline UUID↔server ID mapping, konflikt qarori, product/narx keshlash, naqd/karta
  farqi — pastda).
- **Real internet-uzilish chastotasi haqida ma'lumot yo'q** (quyida 3-bo'limda ochiq savolga
  javob) — XL investitsiyani asoslovchi dalil yo'q, faqat Biznes POS'dan ko'chirilgan taxmin,
  bu esa RESTORAN-floor muhiti (boshqa domen) uchun yozilgan, chakana do'kon kassasi uchun emas.
- To'lov cheklovi: karta/QR terminal odatda o'ziga online ulanish talab qiladi — "offline
  checkout" faqat NAQD to'lov uchun ma'noga ega bo'lardi. Bu C'ning amaliy qamrovini yana
  torytiradi (aralash to'lov — qisman naqd, qisman karta — offline holatda mantiqsiz bo'ladi).
- OFD (fiskal) integratsiyasi kelajakda qo'shilsa, odatda real-time server aloqasi talab
  qiladi — "to'liq offline sotuv" tushunchasi O'zbekiston bozorida umuman tubdan qiyinlashadi.
  C'ga investitsiya qilib, keyin OFD kelganda uni qisman bekor qilish xavfi bor.

**C1 vs C2 ajratish** (SPEC MAY talabi bo'yicha, C tanlanmagan bo'lsa ham hujjatlashtirildi):
- **C1 — faqat sync-queue** (IndexedDB navbat + sync-engine + network-detector, app-shell'siz):
  yuqorida ko'rsatilganidek, Next.js dashboard kontekstida foydasi cheklangan (login/sahifa-ochish
  muammosi hal qilinmaydi). **Hozir tavsiya etilmaydi.**
- **C2 — to'liq offline app-shell/PWA** (service worker, keshlangan POS-sahifa, login-holatini
  saqlash): C1'ning foydasini haqiqiy qiladigan qism, lekin bu **butunlay alohida, katta
  ko'lamli loyiha** — dashboard'ning umumiy auth/routing arxitekturasiga ta'sir qiladi (SPEC
  o'zi buni tan oladi). **Bu spike doirasidan tashqarida** — agar kelajakda haqiqiy talab
  (masalan, ko'p mijozdan "internet tez-tez uziladi" shikoyati) paydo bo'lsa, alohida yangi SPEC
  sifatida PM tomonidan ochilishi kerak, POS-5/POS-6 doirasida EMAS.

---

## 3. SPEC'ning "Ochiq savollar" bo'limiga javob

**Savol 1**: Aniq ERP mijozlari (kichik/o'rta chakana do'konlar) qancha tez-tez internet
uzilishini boshdan kechiradi?

**Javob**: Bu spike doirasida HAQIQIY ma'lumot (support so'rovlari, mijoz fikri) yig'ilmadi —
bu architect spike, mijoz tadqiqoti emas, va bunday ma'lumot hozir mavjud emas deb ochiq
e'tirof etiladi. **Ishchi taxmin (aniq aytilgan, "ehtimol" bilan yashirilmagan)**: chakana
do'kon kassasi — odatda FIKRLI (statsionar) joylashgan, ko'pincha kassa qurilmasi uzluksiz
elektr+internet talab qiladigan boshqa tizimlar (printer, barcode skaner, hatto POS'ning o'zi)
bilan bir xil joyda, shahar sharoitida optik/4G backup keng tarqalgan. Bu **restoran zal-POS**
(stol-stol harakatlanadigan, ko'pincha bodrum/qavat osti joylashgan Wi-Fi'ga tayanadigan qurilma)
dan STRUKTURAV JIHATDAN FARQLI muhit — u yerda uzilish ehtimoli tabiiy ravishda yuqoriroq.
Taxmin: Aniq ERP mijozlarida "soniyalar-o'nlab soniyalar" darajasidagi qisqa uzilish (B
qoplaydi) ehtimoliy, lekin "daqiqalar-soatlar" darajasidagi uzoq to'liq uzilish (faqat C
qoplaydi) kamdan-kam. Shu taxminga asoslanib qaror B tomon og'adi — agar bu taxmin keyinchalik
real support-ma'lumot bilan rad etilsa (masalan ko'p mijoz uzoq uzilish haqida shikoyat qilsa),
bu YANGI SPEC/qayta ko'rib chiqish sababi bo'ladi, hozirgi qarorni retroaktiv noto'g'ri
qilmaydi — bu aynan shu noaniqlik narxini minimallashtirish uchun B (past-xarajat, past-risk)
tanlanishining o'zi sabab.

**Savol 2**: Agar C tanlansa — Next.js service worker/offline app-shell qo'shish SPEC
doirasidan tashqarida qolishi mumkinmi?

**Javob**: Ha, aniq chegaralandi — yuqoridagi C2 ta'rifi. C tanlanmadi, shuning uchun bu savol
amalda bekor, lekin javob hujjatlashtirilishi kerak edi: C2 **har doim** alohida, kelajakdagi,
mustaqil SPEC bo'lishi kerak — POS-5/POS-6 ichida HECH QACHON qurilmaydi, chunki u dashboard
auth/routing arxitekturasiga tegadi (bu spec'ning qamrovidan ancha katta).

---

## 4. POS-6 qamrovi (B asosida) — PM uchun aniq chegara

Bu bo'lim POS-6 ticketini yozish uchun aniq yo'nalish beradi (implementatsiya emas).

### Nima o'zgaradi
- **Backend**: HECH NARSA. Middleware, jadval, whitelist — tayyor. (Agar review paytida
  `/sale/sales` javobida `doc_number`/`id` har doim bitta marta to'g'ri qaytayotgani
  tasdiqlansa — tekshirish, kod yozish emas.)
- **Frontend — ikki fayl**:
  - `apps/web/app/(dashboard)/pos/page.tsx` — `checkout()` (159-188): submit boshida darhol
    (birinchi qatorda, `await`dan OLDIN) loading/disabled holat o'rnatiladi; bitta
    `Idempotency-Key` **checkout-urinish darajasida** (savat tarkibi o'zgarmaguncha yoki
    muvaffaqiyatli bo'lguncha bir xil qoladi, HAR BOSISHDA YANGILANMAYDI) saqlanadi; tarmoq
    darajasidagi xatoda (`ERR_NETWORK`/timeout — axios, `cart.tsx`dagi fetch-asoslangan
    `TypeError`/`TimeoutError` tekshiruvidan farqli, chunki bu yerda `api` — axios instance)
    xuddi shu key bilan bitta avtomatik qayta urinish; muvaffaqiyatda yoki yakuniy (foydalanuvchi
    ko'radigan) xatoda loading holat tozalanadi VA key tozalanadi (keyingi "to'la" bosishi —
    agar savat o'zgarmagan bo'lsa ham — YANGI, ongli urinish hisoblanadi, yangi key oladi).
  - `apps/web/app/m/pos/page.tsx` — `checkout()` (122-146): xuddi shu naqsh; `paying` state
    allaqachon bor — unga idempotency-key logikasi qo'shiladi, ikkinchi disabled-state yozish
    kerak emas.
- **Ikkisi uchun umumiy**: key generatsiyasi/saqlash/retry logikasi kodni ikki joyda
  takrorlamaslik uchun kichik umumiy helper'ga chiqarilishi SHOULD (masalan
  `apps/web/lib/idempotency.ts`) — bu POS-6 ichida backend-dev/frontend-dev ozodligi, DESIGN
  buni majburlamaydi, faqat tavsiya qiladi.

### Nima o'zgarmaydi (qasddan)
- `/sale/sales` so'rov/javob shakli — o'zgarmaydi, faqat header qo'shiladi.
- Hech qanday yangi endpoint, hech qanday DB migratsiya.
- Hech qanday IndexedDB/service worker/offline queue kodi.

### Acceptance criteria (SPEC Scenario 2 va 4'dan to'g'ridan-to'g'ri)

```
Given kassir savatga mahsulot qo'shgan va "Оплатить"ni bosgan
When u tugmani yana tez bossa (tarmoq hali javob bermayapti)
Then ikkinchi bosish HECH QANDAY yangi so'rov yubormaydi (tugma disabled) —
     faqat BITTA so'rov serverga yetadi
```

```
Given checkout() so'rovi yuborilgan, lekin javob kelmasdan tarmoq xatosi yuz bergan
     (ERR_NETWORK/timeout)
When frontend xuddi shu Idempotency-Key bilan avtomatik qayta yuboradi
Then server CACHED javobni qaytaradi (agar birinchi so'rov aslida serverga yetib, sotuv
     yaratilgan bo'lsa) — yangi `sales` yozuvi yaratilmaydi, ombordan ikkinchi marta ayirilmaydi
```

```
Given POS-6 implementatsiyasi tugagan
When kod review o'tkaziladi
Then `pos/page.tsx` va `m/pos/page.tsx`da HAR BIRIDA faqat BITTA `/sale/sales`ga POST
     chaqiruv joyi bor — ikkinchi, "offline-safe bo'lmagan shortcut" yo'l YO'Q
     (Biznes POS'dagi dual-path xatosi takrorlanmaydi — buni tekshirish oson, chunki B
      variantida arxitektura jihatidan ikkinchi yo'l degan narsa UMUMAN mavjud emas)
```

Scenario 3 (to'liq offline rejim) — **amal qilmaydi**, chunki C tanlanmadi.

---

## 5. Risklar va nazorat

- **Noto'g'ri taxmin xavfi** (internet-uzilish chastotasi): agar real foydalanuvchilar uzoq
  uzilishdan shikoyat qilsa — B hali ham foydali qoladi (duplicate-himoya har doim kerak),
  faqat C2 (offline app-shell) alohida SPEC sifatida qayta ko'rib chiqilishi kerak bo'ladi.
  Ya'ni B tanlash C yo'lini yopib qo'ymaydi — B zudlik bilan kerakli himoyani beradi, C esa
  kelajakda ALOHIDA, ma'lumotga asoslangan qaror bo'lib qolaveradi.
- **Idempotency-key noto'g'ri saqlash xavfi** (4-bo'limdagi "key cart-attempt darajasida,
  har-bosishda-emas" talabi): agar POS-6 implementatori buni e'tiborsiz qoldirib, har
  `checkout()` chaqiruvida yangi key generatsiya qilsa (xuddi `cart.tsx`dagi kabi, lekin
  double-click himoyasiz holatda) — ikki marta tez bosish hali ham duplikat yaratadi. **Shuning
  uchun DESIGN aniq ikkala mexanizmni birga talab qiladi: tugma-disable (darhol) + key-reuse
  (urinish ichida)** — faqat birontasi kifoya qilmaydi.
- **OFD/to'lov kelajak-riski** — yuqorida qayd etildi, hozir B'ga ta'sir qilmaydi (B naqd/karta
  farqlamaydi, shunchaki server bilan muloqotni xavfsizlashtiradi), lekin agar kelajakda C
  qayta ko'tarilsa, shu cheklov yangi SPEC'da hisobga olinishi kerak.

## 6. Qamrov-tashqarisida (bu spike + POS-6 uchun)

- Variant C (C1 va C2) — yuqorida sabab bilan rad etildi, implementatsiya qilinmaydi.
- Restoran-POS tushunchalari (`tableId`, kitchen orders, modifikatorlar) — Aniq ERP chakana
  savdo, umuman tegishli emas.
- Multi-device LAN hub/server-discovery — Biznes POS'da ham eksperimental, bu spike doirasida
  ko'rib chiqilmadi.
- Service Worker/PWA app-shell (C2) — kelajakdagi, mustaqil SPEC, POS-5/POS-6 ichida emas.
- OFD/fiskal integratsiya — tegilmaydi, faqat kelajak-eslatma sifatida yozildi.

---

## Qaror MUZLATILDI ✓

Loyiha egasi (inson) shu hujjatni ko'rib chiqib, POS-6 qamrovini (4-bo'lim) tasdiqlashi kerak.
Tasdiqlangandan keyin backend-dev/frontend-dev POS-6'ni mustaqil bajarishi mumkin — yangi
arxitektura qarori kerak emas, faqat 4-bo'limdagi aniq frontend o'zgarishi.

### Tasdiqlash (2026-10-13)

POS-6 bu tasdiqdan oldin implementatsiya qilingan edi (protsess buzilishi). Loyiha egasi
2026-10-13 sessiyasida bu holatni ko'rib chiqdi va natijani (Variant B, lib/idempotency.ts va
payBusyRef re-entrancy guard) tasdiqladi. Backend tomonidagi qo'shimcha o'zgarish
(idempotency/middleware.py) tekshirildi: bu POS-6'ga aloqasi yo'q, boshqa sprintlarning (EC-3,
EC-6, SC-3, RG-6) o'z yangi endpointlari uchun org-id-resolver qo'shilishi edi — "backend'ga
hech narsa kerak emas" da'vosi POS-6 doirasida hamon to'g'ri.
