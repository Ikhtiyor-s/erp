# SPEC — Merchant Admin: Aniq ERP uchun birinchi native mobil (Flutter) ilova — tashkilot admin/manager uchun (2026-10-14)

> PM tomonidan yoziladi. Bu **PROPOSE** bosqichi (`tickets/SDLC.md`).
> Ticket prefiksi: **`MA-`** (`MA-1`..`MA-6`). Mavjud prefikslar tekshirildi (`ls tickets/*.md`,
> 121 fayl): `T-0xx/1xx/2xx` (raqamli), `EC-` (ecommerce), `POS-` (pos-hardware), `RG-`
> (regos-gap), `SC-` (self-checkout). `MA-` bo'sh — **to'qnashuv yo'q**.
> Bu birinchi marta ERP uchun native mobil ilova rejalashtirilayotgani sababli, "yangi modul"
> (SDLC checklist bandi) — shuning uchun bu SPEC `architect`ga `DESIGN-merchant-admin.md`
> (API kontrakt muzlatilgan + Flutter skeleton) yozishni topshiradi. **Bu hujjat API
> kontraktni muzlatmaydi** — faqat zond (reconnaissance) + ticket breakdown.

## 0. Birlamchi referens — noldan loyihalanmaydi

Opera egasi va vazifa ta'rifi aniq ko'rsatganidek: **`D:\Docker\projects\pos\apps\merchant-admin\`**
(Biznes POS, Node/Express backend, boshqa kodbaza) aynan shu muammoni — do'kon/restoran
egasi/menejeri uchun to'liq REGOS-parity mobil admin ilova — yaqinda qurib, QA'dan o'tkazgan.
O'qilgan: to'liq `lib/**` daraxti (41 fayl: services/screens/state/router/widgets) va
`tickets/DESIGN-MA1.md` (UX/ekran kontrakti, Provider+go_router+Dio+flutter_secure_storage+
FCM+socket.io arxitekturasi). **Bu SPEC UX/ekran g'oyasi va Flutter arxitektura naqshini
ko'chiradi, lekin API kontraktni ERP'ning haqiqiy FastAPI backend'iga qarshi yangidan
xaritalaydi** — Node/Express marshrutlari ERP'da yo'q, va ERP domeni POS'dan kengroq
(buxgalteriya, ombor, ishlab chiqarish, customer_portal, storefront, kiosk, marketing) —
shuning uchun "butun ERP'ni telefon ekraniga siqish" emas, REGOS-parity uchun real kerakli
qismlar tanlanadi.

## 1. Niyat (1 abzats)

Aniq ERP hozir **faqat veb-ilova**: `apps/web` (Next.js, desktop `(dashboard)/` + mobil PWA
`m/` route-guruhi). Hech qanday native (Flutter/Swift/Kotlin) kod yo'q — bu ERP tarixidagi
**birinchi** native mobil ilova. Tashkilot egasi/menejeri hozir kundalik ko'rsatkichlarni
(savdo, qoldiq, qarz), katalogni (mahsulot/kategoriya), xodimlarni, xarajatlarni va
smena/kassani kuzatish/boshqarish uchun telefonda brauzer orqali mobil PWA'ga kirishga
majbur — bu "haqiqiy ilova" tuyg'usini bermaydi (push-bildirishnoma, home-screen belgisi,
offline-ish o'qish keshi yo'q). Bu SPEC `apps/merchant-admin` nomli Flutter ilovasini
REGOS-parity ko'lamida (lekin ERP domeniga moslashtirilgan holda) rejalashtiradi: dashboard/
KPI, katalog ko'rish+boshqarish, statistika/hisobotlar, xodimlar, xarajatlar/kassa-smena,
va buyurtmalarni (faqat ko'rish, pastda izoh) — bitta telefon ekranidan.

## 2. Tegishli foydalanuvchi

- **Asosiy**: ERP'ning **`admin`** roli — tashkilot darajasidagi to'liq huquqli foydalanuvchi.
  **Muhim aniqlik (vazifa ta'rifida so'ralgan tekshiruv natijasi)**: ERP'da POS'dagi kabi
  alohida `MERCHANT_OWNER` roli **yo'q**. `apps/api/app/modules/rbac/permissions.py` va
  `CLAUDE.md`ga ko'ra ERP'ning 6 tizim roli: `superadmin, admin, manager, accountant,
  cashier, viewer`. Tashkilot "egasi" tushunchasi alohida rol emas — bu shunchaki `admin`
  rolidagi foydalanuvchi (bir tashkilotda bir nechta `admin` bo'lishi mumkin — ERP'da
  "yagona egasi" cheklovi yo'q). Shuning uchun **ERP'da "MERCHANT_OWNER ekvivalenti" = `admin`
  roli**, POS'ning `MANAGER`'i esa ERP'ning `manager` roliga to'g'ri keladi.
- **Ikkinchi darajali**: ERP **`manager`** roli — operatsion huquqlar (savdo, ombor, moliya
  ko'rish/yaratish), lekin `settings`/`rbac`/`hr.payroll.approve`/`hr.payroll.pay` yo'q
  (`ROLE_GRANTS["manager"]`, `permissions.py`).
- **Tegmaydi**: `accountant`, `cashier`, `viewer`, superadmin (platforma darajasi), mijoz/
  customer_portal foydalanuvchisi. Sabab: POS'ning o'z sister-ilovasi ham faqat
  `MERCHANT_OWNER`+`MANAGER`ni qamragan (`DESIGN-MA1.md` §8) — bu ilova ham xuddi shu
  tor-doirali qarorni meros qiladi, kengaytirilmaydi (pastda QILMAYMIZ'da qayd etilgan).
- **Muhim arxitektura topilmasi — rol nomi emas, permission kodi bilan gate qilinadi**:
  POS'ning `DESIGN-MA1.md`'si navigatsiyani literal rol nomi bilan gate qiladi (masalan
  "Dashboard tab hidden for MANAGER"). ERP'da bu yondashuv **ishlamaydi**, chunki
  `CLAUDE.md`: "Roles jadvali: tizim rollar + **per-org custom rollar**" — bitta tashkilot
  o'zining "Egasi" nomli custom rolini yaratishi mumkin, u sistema `admin`'idan farqli kod
  bilan. ERP'da `GET /auth/me` **rol/permission qaytarmaydi** (faqat `id, phone, email,
  full_name, locale`) — buning o'rniga **`GET /rbac/me/permissions`** bor
  (`apps/api/app/modules/rbac/router.py:27`), qaytaradi:
  `{role: {code, name}, permissions: [...kod ro'yxati...], is_superadmin: bool}`.
  **Flutter ilova navigatsiya/tugma ko'rinishini shu `permissions` massividan kelib chiqib
  gate qilishi SHART** (masalan `"hr.payroll.approve" in permissions`), rol nomini
  hardcode qilib emas — aks holda custom rol yaratgan tashkilotda ilova noto'g'ri ishlaydi.
  Bu `architect`ga `DESIGN-merchant-admin.md`'da aniq ko'rsatma sifatida o'tadi.

## 3. Backend tadqiqoti — modul → ekran xaritasi (tasdiqlangan, taxmin qilinmagan)

| Mobil ekran | Backend modul | Asosiy endpoint(lar) | Holat |
|---|---|---|---|
| Dashboard/KPI | `statistics` | `GET /statistics/dashboard` (bugungi/oylik savdo, kassa, qarz, ombor qiymati) | **Tayyor, qayta ishlatiladi** |
| Statistika/hisobotlar | `statistics` | `/daily-revenue`, `/sales-summary`, `/sale-by-category`, `/sale-by-employee`, `/sale-by-customer`, `/sale-by-payment-type`, `/cogs` (`statistics.cogs.view` kerak), `/unsold-goods`, `/export/{report}` | **Tayyor, qayta ishlatiladi** |
| Katalog — mahsulot | `warehouse` | `GET/POST/PUT/DELETE /warehouse/products`, `/products/{id}/full`, paginatsiya (T-026) | **Tayyor** (`warehouse.product.view`/mutatsiya uchun 3-qism kodlar) |
| Katalog — kategoriya | `warehouse` | `GET/POST/PUT/DELETE /warehouse/categories` | **Tayyor**, lekin explicit `require_permission` yo'q ko'rinadi — auto-derive middleware orqali kengroq `warehouse.*` kodiga tushishi mumkin. **Architect aniq kodni tasdiqlashi kerak**, taxmin qilinmasin. |
| Katalog — modifikator/variant (POS'dagi "extra cheese" kabi) | — | — | **ERP'da ekvivalenti YO'Q.** ERP'da "BOM" (`warehouse` moduli, T-022/024/026/027) bor, lekin bu ishlab chiqarish retsepti (manufacturing), mijozga ko'rinadigan modifikator emas — boshqa tushuncha. Modifikator management bu ilovaga **kiritilmaydi** (pastda QILMAYMIZ). |
| Xodimlar | `hr` | `/positions`, `/employees`, `/roles`, `/kpi`, `/shifts`, `/attendance/clock-in|out`, `payroll_router.py`: `/runs`, `/runs/{id}/approve` (`hr.payroll.approve`), `/runs/{id}/pay` (`hr.payroll.pay`) | **Tayyor.** Payroll approve/pay — faqat `admin`/`accountant`da bor, `manager`da **yo'q** (`ROLE_GRANTS`) — ilovada shu bo'yicha gate kerak. |
| Xarajatlar | `finance` | `GET/POST/DELETE /finance/extra-costs` | **Tayyor** |
| Kassa/smena (till-shift) | `mobile` | `/cashbox-sessions/open`, `/{id}/close`, `/active`, `/{id}/totals`, `GET /cashbox-sessions` | **Tayyor, to'g'ridan-to'g'ri qayta ishlatiladi** — ERP'ning mavjud mobil PWA uchun allaqachon qurilgan smena-yopish logikasi (jumladan REGOS-parity "kutilayotgan cheklar" bloki va PosPoint-parity avto-inkassatsiya) bor, **yangidan yozilmaydi**. |
| Buyurtmalar (faqat ko'rish) | `sale` | `sale/router.py` (`create_sale` va h.k. — to'liq o'qilmagan, lekin checkout logikasi mavjud) | Ilovada **faqat ro'yxat/holat ko'rish** doirasida — to'liq POS checkout **emas** (pastda §6 va QILMAYMIZ) |
| Shtrix-kod skaner | `warehouse` | `warehouse.product.barcode_view` (mavjud T-102/T-134 naqshlari) | Faqat **mahsulot qidirish** uchun qayta ishlatiladi, chop etish/uskuna integratsiyasi **emas** |
| Push-bildirishnoma | `mobile` | `POST /push/register`, `DELETE /push/{token}` | **Ro'yxatga olish infratuzilmasi bor**, lekin **jo'natuvchi (sender) xizmati tasdiqlanmadi** — hech qayerda bu `push_tokens` jadvaliga asoslangan real yuborish kodi topilmadi bu tadqiqot doirasida. Bu push'ni "future/MAY", hozircha "register-only" qiladi — pastda Risklar/Ochiq savollarda qayd etilgan. |
| Sozlamalar | `mobile` + `auth` | `/push/register`, logout (mavjud JWT oqimi) | Qisman tayyor; "ro'yxatdagi qurilmalarni ko'rish" (POS'dagi `GET /fcm/devices` ekvivalenti) ERP'da **yo'q** — kerak bo'lsa `MA-2`da qo'shiladi |
| "Filial solishtirish" (POS'ning branch-compare) | — | — | **ERP'da bola-tashkilot/filial tushunchasi (POS'dagi `Tenant.parentId`) yo'q.** Eng yaqin proksi — bir nechta `warehouses` bir tashkilotda, lekin bu "filial" emas, "ombor". Bu funksiya **v1'da qilinmaydi** (QILMAYMIZ) — agar kelajakda kerak bo'lsa, bu alohida SPEC (filiallashtirish arxitekturasi), shoshilib ombor-bo'yicha taqqoslashga aylantirilmasin. |

### RBAC — permission katalogi tasdiqlandi

`apps/api/app/modules/rbac/permissions.py` to'liq o'qildi. `admin` — `ALL_PERMISSIONS`ning
hammasi. `manager` — operatsion to'plam (yuqoridagi jadvalda ko'rsatilgan istisnolarsiz).
`accountant`/`cashier`/`viewer` — bu ilova doirasidan tashqari (§2).

## 4. `tickets/SPEC-desktop-mobile-apps.md` bilan munosabat (2026-10-13, hali javobsiz)

Bu alohida, **oldin yozilgan va hali hal qilinmagan** reja mavjud: Linux desktop (Electron)
+ iOS (Capacitor) native "qobiq" ilovalar, **`apps/web` POS sahifasini** o'rab, **`kassir`**
persona uchun (kassa terminali ekrani). U hali 5 ochiq savolga javob olmagan, `DESIGN.md`
yozilmagan, kod boshlangani yo'q.

**Aniq aytilishi kerak**: bu ikki tashabbus **bir-biriga ziddiyat emas**:
- **Foydalanuvchi boshqa**: `SPEC-desktop-mobile-apps.md` → `kassir` (POS terminalida turgan
  xodim). Bu SPEC → `admin`/`manager` (biznes egasi/menejeri, odatda telefonda, ofisdan
  tashqarida).
- **Ekran boshqa**: u — checkout/to'lov ekrani (mavjud `apps/web/app/(dashboard)/pos` yoki
  `app/m/pos`ni qobiqqa o'rash). Bu — dashboard/katalog/hisobot/xodim boshqaruv ekranlari,
  noldan Flutter'da qurilgan, checkout emas.
- **Texnologiya ataylab farqli, va bu haqiqiy tradeoff, bu SPEC uni HAL QILMAYDI**: agar
  ikkisi ham oxir-oqibat amalga oshsa, ERP'da **ikki xil native-ilova texnologik stack**
  birga yashaydi — kassir tomonida Capacitor/Electron (**mavjud veb UI'ni qayta ishlatish**),
  merchant-admin tomonida **noldan Flutter** (umuman yangi UI kodbaza). Bu ikki alohida
  build pipeline, ikki alohida bog'liqlik ekotizimi, va uzoq muddatda ikki alohida
  qo'llab-quvvatlash yuki degani. **Bu PM tomonidan hal qilinmaydi** — egasining e'tiboriga
  qo'yiladi (pastda Ochiq savollar #1), chunki ikkisi ham mustaqil ravishda to'g'ri qarorlar
  bilan tanlangan (checkout uchun veb-UI qayta ishlatish arzonroq va to'g'ri; REGOS-parity
  to'liq boshqaruv ilovasi uchun esa mavjud veb-UI "desktop-first" dizaynga mos emas va
  Flutter'ning sister-loyihada isbotlangan naqshi mavjud) — lekin yig'indida stack
  xilma-xilligi real narx.

## 5. Acceptance criteria (Given/When/Then)

**Scenario 1 — permission-asosli navigatsiya (rol literal emas)**
- **Given** `admin` roli bilan kirgan foydalanuvchi va alohida, custom nomli (masalan
  "Egasi") lekin bir xil grant'larga ega rol bilan kirgan boshqa foydalanuvchi
- **When** ikkisi ham ilovaga kiradi
- **Then** ikkisida ham bir xil tab/tugmalar ko'rinadi — chunki gate `GET /rbac/me/permissions`
  dan qaytgan `permissions` massividan, rol **kodi**ning literal qiymatidan emas

**Scenario 2 — multi-tenant izolyatsiya**
- **Given** Tashkilot A'da kirgan foydalanuvchi
- **When** ilova har qanday ro'yxat/yaratish so'rovini yuboradi
- **Then** `Authorization` + `X-Organization-Id: <A>` header'lari har bir so'rovda bor (mavjud
  veb-client naqshiga mos), va javobda faqat A'ga tegishli yozuvlar qaytadi — B tashkilot
  ma'lumoti hech qachon ko'rinmaydi (backend allaqachon shu filtrni qo'llaydi, client
  faqat to'g'ri header yuborishi kifoya)

**Scenario 3 — smena ochish/yopish, mavjud backend logikasi bilan**
- **Given** `admin`/`manager` ilovada kassa tanlagan
- **When** "Smenani ochish" bosiladi (`POST /cashbox-sessions/open`) va keyinroq "Yopish"
  (`POST /cashbox-sessions/{id}/close`)
- **Then** `erp-postgres`'dagi `cashbox_sessions` jadvalida mos yozuv ko'rinadi, va agar
  kutilayotgan (`on_hold`) chek bo'lsa — backend yopishni rad etadi (mavjud REGOS-parity
  tekshiruvi, ilova bu xabarni ko'rsatadi, qayta amalga oshirmaydi)

**Scenario 4 — payroll approve/pay faqat ruxsat bor rollarga**
- **Given** `manager` roli (uning grant'ida `hr.payroll.approve`/`hr.payroll.pay` YO'Q)
- **When** Xodimlar → Payroll ekraniga kiradi
- **Then** "Approve"/"Pay" tugmalari ko'rinmaydi (ro'yxat/ko'rish qoladi) — `admin`/
  `accountant` kirganda esa ko'rinadi

**Scenario 5 — katalog mutatsiyasi ERP veb-admin bilan bir xil ma'lumotga yozadi**
- **Given** mobil ilovada yangi mahsulot/kategoriya yaratilgan
- **When** shu tashkilot egasi `apps/web/(dashboard)/warehouse/products` sahifasini ochadi
- **Then** yangi yozuv u yerda ham ko'rinadi — bitta backend, shadow-data yo'q

**Scenario 6 — offline/tarmoqsiz holatda buzilmaslik**
- **Given** telefon tarmoqdan uzilgan
- **When** foydalanuvchi Dashboard'ni ochadi
- **Then** oxirgi muvaffaqiyatli keshlangan ma'lumot "offline" belgisi bilan ko'rsatiladi
  (POS sister-ilovasining `local_cache.dart` naqshi), lekin pul harakatlantiruvchi amal
  (smena yopish, xarajat yaratish) **hech qachon** jim navbatga qo'yilmaydi — tarmoq
  xatosi ochiq ko'rsatiladi (POS `DESIGN-MA1.md` §9'dagi "fail loud for money" qarori
  bu loyihaga ham meros qilinadi)

## 6. Talablar (RFC 2119)

- **MUST**: Navigatsiya/tugma ko'rinishi `GET /rbac/me/permissions`dan qaytgan `permissions`
  kod ro'yxatiga asoslanishi shart — rol nomi/kodi hardcode taqqoslanmasin (§2, §5-Sc.1).
- **MUST**: Har bir API so'rovida mavjud JWT access/refresh oqimi + `X-Organization-Id`
  header ishlatilishi shart — yangi auth protokoli YOZILMASIN (`CLAUDE.md` POYDEVOR
  qoidasi #4).
- **MUST**: Smena (till-shift/kassa) funksiyasi `mobile` moduldagi mavjud
  `/cashbox-sessions/*` endpoint'larini qayta ishlatishi shart — paralel/duplikat
  "smena" tushunchasi yangidan yozilmasin (`finance`da alohida emas).
- **MUST**: Har qanday yangi/o'zgargan backend endpoint (agar `MA-2` shuni topsa) mavjud
  `rbac/permissions.py` katalogidagi kodga ega bo'lishi, yoki yangi kod qo'shilsa — shu
  kod `admin` va kerakli rollarga (`ROLE_GRANTS`) grant qilinishi shart.
- **MUST NOT**: Yangi backend **modul** (masalan `app/modules/merchant_admin/`) YARATILMASIN
  — bu ilova mavjud modullarning (`mobile`, `statistics`, `hr`, `finance`, `warehouse`,
  `rbac`, `sale`) ustiga quriladigan **client**, backend arxitekturasi o'zgarmaydi
  (`CLAUDE.md` anti-pattern: "Yangi modul yaratish (avval mavjudni kengaytirish)").
- **SHOULD**: Pul harakatlantiruvchi mutatsiyalar (smena yopish, xarajat yaratish, payroll
  pay) tarmoqsiz holatda jim navbatga qo'yilmasin — xato ochiq ko'rsatilsin (POS
  sister-loyihaning asosli qarori, §5 Sc.6).
- **SHOULD**: Mavjud ERP mobil PWA (`apps/web/app/m/`) ushbu loyiha davomida o'zgarishsiz
  qolsin — ikki "mobil yuzaga" bir vaqtda xizmat ko'rsatish qarori hali qabul qilinmagan,
  bu SPEC uni ham hal qilmaydi (Ochiq savol #3).
- **MAY**: Push-bildirishnoma (`POST /push/register`) ro'yxatga olinishi mumkin, lekin
  backend tomonda haqiqiy jo'natuvchi (sender) xizmati tasdiqlanmagani sababli (§3-jadval),
  bu v1'da "ro'yxatga olish ishlaydi, lekin bildirishnoma kelishi kafolatlanmaydi" holatida
  qolishi mumkin — `MA-1` bu holatni aniq belgilashi kerak.

## 7. QILMAYMIZ (qamrov-tashqarisida — aggressiv)

- ❌ **Checkout/POS-kassa ekrani** — bu `kassir` personasiga tegishli, mavjud/rejalashtirilgan
  `SPEC-desktop-mobile-apps.md` doirasida, bu SPEC uni takrorlamaydi (§4).
  "Buyurtmalar" ekrani bu ilovada **faqat ko'rish/holat**, yangi sotuv yaratish/to'lov
  qabul qilish YO'Q.
- ❌ **Bluetooth chek printeri/kassa qutisi/tarozi integratsiyasi** — `apps/web/lib/
  bt-printer.ts` uskuna-qatlami bu ilovaga ko'chirilmaydi; "skaner" funksiyasi faqat
  mahsulot-qidirish uchun (kamera orqali shtrix-kod o'qish), uskunaga ulanish yo'q.
- ❌ **Modifikator/variant boshqaruvi** (POS'dagi "Extra Cheese" kabi) — ERP'da bu
  tushunchaning ekvivalenti yo'q, BOM (manufacturing retsept) bilan aralashtirilmasin (§3).
- ❌ **"Filial taqqoslash" (branch comparison)** — ERP'da bola-tashkilot/filial arxitekturasi
  yo'q; ombor-bo'yicha taqqoslashga shoshilib aylantirilmaydi (§3, alohida SPEC kerak
  bo'lsa).
- ❌ **iOS build** — v1 **faqat Android** (POS sister-loyihasi ham xuddi shunday qaror
  qilgan: hech qaysi mavjud Flutter ilova iOS'ni isbotlamagan; ERP'da esa Flutter kodi
  umuman yo'q — noldan iOS signing/build zanjiri qo'shish bu SPEC ko'lamidan tashqarida).
- ❌ **Offline-first mutatsiya navbati (SQLite queue)** — faqat o'qish-keshi (`local_cache`
  naqshi) qoladi, yozish amallari tarmoqsiz holatda navbatga qo'yilmaydi (§6 SHOULD,
  §5 Sc.6).
- ❌ **Mavjud `apps/web/app/m/` mobil PWA'ni o'chirish yoki rebuild qilish** — ikkisi
  parallel yashaydi, bu SPEC migratsiya/freeze qarorini qabul qilmaydi (Ochiq savol #3).
- ❌ **Yangi backend modul yaratish** (`app/modules/merchant_admin/` kabi) — mavjud
  modullar kengaytiriladi, xolos (§6 MUST NOT).
- ❌ **Push-bildirishnoma jo'natuvchi (sender) infratuzilmasini qurish** (masalan FCM
  service account, Eskiz push va h.k.) — faqat mavjud ro'yxatga olish endpoint'lari
  ishlatiladi; real jo'natish — alohida, kelajakdagi ticket (§3, Ochiq savol #5).
- ❌ **`accountant`/`cashier`/`viewer` rollari uchun qo'llab-quvvatlash** — faqat `admin`/
  `manager` (§2).

## 8. Ma'lumotlar izolyatsiyasi (data isolation note)

Bu ilova **hech qanday yangi domain jadval yaratmaydi** (hozirgi ko'lamda) — faqat mavjud,
allaqachon `organization_id`-filtrlangan endpoint'larni iste'mol qiladi (`statistics`,
`warehouse`, `hr`, `finance`, `mobile`). Shuning uchun `CLAUDE.md` POYDEVOR qoidalari #1-3
(har jadvalda `organization_id`, har SELECT shu bilan filtrlangan, composite indeks) bu
SPEC uchun **o'zgarmaydi** — ular allaqachon backend tomonida bajarilgan. Yagona yangi
talab: client (Flutter) **har doim** `X-Organization-Id` header'ini yuborishi (qoida #4),
va agar `MA-2` yangi endpoint qo'shsa, u ham xuddi shu filtrlash patterniga rioya qilishi
shart (`WHERE organization_id = :o`, bound parametr, f-string interpolyatsiyasiz —
`CLAUDE.md` Backend konvensiyalari).

## 9. Risklar (yashirilmaydi)

- **Push-bildirishnoma jo'natuvchisi tasdiqlanmagan** (§3) — agar `MA-1`/`MA-2` buni
  aniqlay olmasa, "Sozlamalar → Bildirishnomalar" ekrani foydalanuvchiga yolg'on kutish
  (ro'yxatdan o'tdim, lekin hech qachon kelmaydi) berishi mumkin — UI matnida aniq
  ko'rsatilishi kerak ("Bu funksiya hali faollashtirilmagan"), jim qoldirilmasin.
- **`/warehouse/categories` endpoint'larida aniq permission kodi tasdiqlanmagan** (§3-jadval)
  — agar auto-derive middleware kutilmagan kodga tushsa (masalan `manager`ga ruxsat
  bermasa), bu `MA-1` bosqichida aniqlanishi kerak, `MA-5` boshlanishidan oldin.
  Tasdiqlanmasdan taxmin qilinsa, frontend 403 bilan "buzilgan" ko'rinadi.
- **ERP'da Flutter/mobil-dev rolga ega maxsus agent card yo'q** — `CLAUDE.md`'dagi
  build-team ro'yxati (`pm, cto, architect, backend-dev, frontend-dev, qa-reviewer`) orasida
  "flutter-dev" yo'q. Quyidagi ticketlarda `flutter-dev` deb nomlangan, lekin bu rol
  haqiqatda mavjud emas — odam buni `frontend-dev`ga yuklash yoki yangi agent-card
  yaratish kerak (Ochiq savol #2).
- **Ikki native-stack tradeoff (§4)** — agar ikkala tashabbus (bu + `SPEC-desktop-mobile-
  apps.md`) ham amalga oshsa, uzoq muddatli ikki alohida build/qo'llab-quvvatlash yuki —
  bu PM tomonidan hal qilinmagan, egasiga ochiq qoldirilgan.
- **ERP mobil PWA (`apps/web/app/m/`) bilan funksional qoplanish** — ba'zi ekranlar
  (masalan dashboard) ikkala yuzada ham bor bo'lib qoladi; qaysi birini "asosiy" deb
  e'lon qilish (agar umuman kerak bo'lsa) hal qilinmagan savol (Ochiq savol #3).
- **Sister-loyiha naqshlari 1:1 ko'chirilmasligi kerak joylar** — `DESIGN-MA1.md` ba'zi
  qarorlari (masalan rol-literal gate, FCM) ERP kontekstida to'g'ridan-to'g'ri ishlamaydi
  (§2, §3) — agar `architect` buni e'tiborsiz qoldirib shablon sifatida mexanik nusxalasa,
  ilova noto'g'ri RBAC xatosiga ega bo'ladi.

## 10. Tegishli modullar (referens)

- `apps/api/app/modules/mobile/router.py` — `/cashbox-sessions/*`, `/push/*`, `/open-tickets/*`
  (restoran-stol, ehtimol kelajakda), `/passcode/*` (device PIN/biometrik — MAY, v1 shart emas)
- `apps/api/app/modules/statistics/router.py` — dashboard + hisobotlar
- `apps/api/app/modules/hr/router.py`, `hr/payroll_router.py` — xodimlar/payroll
- `apps/api/app/modules/finance/router.py` — `/extra-costs` (xarajatlar), `/cashboxes`
- `apps/api/app/modules/warehouse/router.py` — `/products`, `/categories`
- `apps/api/app/modules/rbac/router.py` — `GET /rbac/me/permissions` (navigatsiya gate manbasi)
- `apps/api/app/modules/rbac/permissions.py` — `ALL_PERMISSIONS`, `ROLE_GRANTS`
- `apps/api/app/modules/auth/router.py` — `/login`, `/refresh`, `/me` (rol/permission
  QAYTARMAYDI — izoh uchun)
- **Referens (boshqa loyiha, faqat o'qish uchun)**: `D:\Docker\projects\pos\apps\merchant-admin\
  lib\**`, `D:\Docker\projects\pos\tickets\DESIGN-MA1.md`
- **Bog'liq, hal qilinmagan PM hujjati**: `tickets/SPEC-desktop-mobile-apps.md` (§4)

## 11. O'zbek bozori xosligi

- **OFD**: ✗ tegmaydi — bu ilova checkout qilmaydi (§7)
- **MXIK**: ✗ tegmaydi bevosita (mahsulot ma'lumotida allaqachon bor, faqat ko'rsatiladi)
- **QQS**: ✗ tegmaydi bu sprintda
- **TIN/STIR**: ✗ tegmaydi
- **SMS (Eskiz)**: ✗ tegmaydi — push ERP'ning mavjud `push_tokens` infratuzilmasi orqali,
  SMS emas
- **To'lov**: ✗ tegmaydi — checkout qamrovdan tashqarida
- **Qurilma bozori**: ⚠️ bilvosita bog'liq — O'zbekistonda tashkilot egalari ko'pincha
  Android qurilma ishlatadi (iOS kamroq keng tarqalgan savdo segmentida) — Android-first
  qaror (§7) shu amaliy haqiqatga ham mos keladi, faqat POS sister-loyihaning texnik
  cheklovidan kelib chiqmaydi.

## 12. Effort estimation (taxminiy)

- `MA-1` (architect, DESIGN): S-M — ~1 kun (ko'p qism tadqiqot bu SPEC'da allaqachon
  qilingan, lekin API kontraktni so'z-boso'z muzlatish va Flutter skeletonni belgilash
  qoladi)
- `MA-2` (backend-dev, gap-closing): XS-S — ~0.5 kun (faqat `MA-1` aniq topgan bo'shliqlar,
  ko'pi allaqachon tayyor)
- `MA-3` (flutter-dev, skeleton+auth): M — ~2 kun
- `MA-4` (flutter-dev, dashboard+statistika): M — ~2 kun
- `MA-5` (flutter-dev, katalog CRUD): M — ~2 kun
- `MA-6` (flutter-dev, buyurtmalar+smena+xodim+xarajat+sozlama): L — ~3 kun
- **Jami**: ~10-11 kun (bitta flutter-dev uchun ketma-ket; `MA-4`/`MA-5`/`MA-6` `MA-3`dan
  keyin parallel bo'lishi mumkin agar bir nechta flutter-dev bo'lsa — pastda qarang)

## 13. Ochiq savollar (egasi uchun, `architect` boshlashidan OLDIN javob kerak)

1. **Ikki native-stack tradeoff (§4, §9)** — `SPEC-desktop-mobile-apps.md` (kassir,
   Capacitor/Electron) va bu SPEC (admin/manager, Flutter) ikkisi ham davom etsa, ERP
   ikki alohida native-texnologiya stackiga ega bo'ladi. Bu qabul qilinadimi, yoki
   ikkisidan birini qayta ko'rib chiqish kerakmi? **Bu SPEC tanlov qilmaydi**, faqat
   bayroq ko'taradi.
2. **"flutter-dev" roli mavjud emas** (`CLAUDE.md` build-team ro'yxatida yo'q) — pastdagi
   ticketlarda shu nom ishlatilgan. Buni `frontend-dev` zimmasiga yuklaymizmi, yoki yangi
   agent-card (`\.claude\agents\flutter-dev.md` kabi) yaratilsinmi?
3. **Mavjud mobil PWA (`apps/web/app/m/`) taqdiri** — bu yangi native ilova bilan parallel
   abadiy yashaydimi (xuddi POS'da `merchant-mobile`/`mobile-boss` bilan bo'lgani kabi,
   "freeze-after-pilot" qarori kerak bo'ladimi), yoki PWA faqat boshqa persona
   (masalan kassir/xodim) uchun qoladimi? Aniq emas, bu SPEC hal qilmaydi.
4. **"Filial taqqoslash" kerakmi?** (§3, §7) Agar egasi bu funksiyani muhim deb hisoblasa,
   bu alohida arxitektura savoli (ombor ≠ filial) — alohida kelajakdagi SPEC kerak bo'ladi,
   bu safar v1'ga kiritilmaydi.
5. **Push-bildirishnoma jo'natuvchisi qurilishi kerakmi, hozir yoki keyinroq?** (§9) Agar
   "hozir" bo'lsa, bu `MA-2` ko'lamini sezilarli kengaytiradi (yangi tashqi integratsiya —
   FCM service account yoki shunga o'xshash, `settings.integration` naqshiga o'xshash)
   — bu alohida ticket/qaror, `MA` ko'lamiga sukut bo'yicha kiritilmagan.
6. **Android `applicationId`/brend nomi** — POS'ning `uz.biznes.merchantadmin` naqshiga
   o'xshab, ERP uchun nima tanlanadi (masalan `uz.aniqerp.merchantadmin`)? `architect`
   `DESIGN-merchant-admin.md`da taklif qiladi, lekin yakuniy brend nomi odam tasdig'ini
   talab qiladi (ilova do'konida ko'rinadigan nom).

## 14. Rollback rejasi

Qo'llanilmaydi hali — bu bosqichda kod yozilmagan (SPEC+ticket faqat). `architect`
`DESIGN-merchant-admin.md` yozgandan keyin, u o'z rollback rejasini (masalan: yangi Flutter
ilova alohida repo-qismi, backend'ga hech qanday breaking o'zgarish kiritilmaydi, shuning
uchun rollback = shunchaki ilovani nashr qilmaslik) aniq belgilaydi.

## 15. Tickets

| Ticket | Sarlavha | Owner | Depends on |
|---|---|---|---|
| `MA-1` | Architect design — API contract freeze + Flutter skeleton | architect | none |
| `MA-2` | Backend gap-closing (faqat `MA-1` topgan bo'shliqlar) | backend-dev | MA-1 |
| `MA-3` | Flutter app skeleton — auth, API client, permission-asosli nav | flutter-dev | MA-1 |
| `MA-4` | Dashboard + Statistika/hisobot ekranlari | flutter-dev | MA-1, MA-2 |
| `MA-5` | Katalog (mahsulot+kategoriya) CRUD ekranlari | flutter-dev | MA-1, MA-3 |
| `MA-6` | Buyurtmalar(ko'rish)+Smena+Xodim+Xarajat+Sozlama ekranlari | flutter-dev | MA-1, MA-2, MA-3 |

**Parallel ishlash tavsiyasi**: `MA-1` birinchi, yakka. `MA-1` tugagandan keyin `MA-2`
(backend-dev) va `MA-3` (flutter-dev, skeleton) **parallel** boshlanishi mumkin (bir-biriga
bog'liq emas). `MA-3` tugagandan keyin `MA-4`/`MA-5`/`MA-6` **parallel** (agar bir nechta
flutter-dev bo'lsa) — hammasi `MA-3`'ning skeleton/router/auth asosida quriladi, lekin
bir-birining fayllariga tegmaydi (POS sister-loyihaning "file-collision rule" naqshi,
`DESIGN-MA1.md` §3 — `architect` buni `DESIGN-merchant-admin.md`da ham aniq yozishi kerak).
