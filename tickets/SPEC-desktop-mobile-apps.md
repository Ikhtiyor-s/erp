# SPEC — Desktop (Linux) va Mobile (iOS) alohida native ilovalar: texnologiya tanlovi (2026-10-13)

> PM tomonidan yoziladi. Bu **PROPOSE** bosqichi, FAQAT REJALASHTIRISH.
> Egasi 2026-10-13'da aniq so'radi: hozirgi Next.js veb-ilova (`apps/web`) ustiga, ALOHIDA
> native ilovalar — Linux'da ishlaydigan desktop ilova va iOS'da ishlaydigan mobil ilova.
> Egasi o'zi tasdiqladi: **bu safar faqat reja** — hech qanday kod yozilmaydi, faqat variant
> tahlili + tavsiya. Shu sababli bu hujjatda implementatsiya ticketlari (masalan `DT-1`, `MT-1`
> kabi yangi prefiks) OCHILMAYDI — bu repo SDLC'siga ko'ra (`tickets/SDLC.md`), texnologiya
> tanlovi egasi tomonidan tasdiqlangandan KEYIN `architect` DESIGN.md yozadi, undan keyin PM
> implementatsiya ticketlarini alohida navbatda ochadi.

## Niyat (1 abzat)

Aniq ERP hozir faqat veb-ilova sifatida mavjud: `apps/web` (Next.js 15, desktop `(dashboard)/`
va mobil PWA `m/` route-guruhlari). POS ekranlari (`apps/web/app/(dashboard)/pos/page.tsx`,
`apps/web/app/m/pos/page.tsx`) shu sessiyada haqiqiy uskuna bilan ishlaydigan qildi: chek
printeri + kassa qutisi + elektron tarozi Web Bluetooth orqali (`apps/web/lib/bt-printer.ts`),
shtrix-kod skanerlash HID-wedge + kamera + WebSerial orqali (`apps/web/lib/scanner.ts`). Bu
butunlay **brauzer-ichida** ishlaydi — alohida "ilova" yo'q, kassir har safar brauzer oynasini
ochadi. Egasi endi alohida desktop (Linux ustuvor) va mobil (iOS ustuvor) ilova so'radi —
sabab aniq aytilmagan (ehtimol: taskbar/home-screen belgisi, brauzer-manzil satrisiz "haqiqiy
dastur" tuyg'usi, yoki aynan iOS Safari'da Web Bluetooth ISHLAMAYDI degan haqiqiy texnik
cheklovdan qochish). Bu SPEC variantlarni taqqoslaydi — hali texnologiya tanlanmagan.

## Tegishli foydalanuvchi

- **`kassir`** — asosiy foydalanuvchi, desktop (Linux POS terminal) va mobil (iOS telefon/
  planshet) ikkisida ham POS ekranini ishlatadi.
- **`admin`/`manager`** — ilovani o'rnatish/yangilanishini kutadi, real qaror qabul qiluvchi
  bu SPEC bo'yicha — loyiha egasi.
- Mijoz — **tegmaydi**, bu ichki xodim-ilovasi, mijozga ochiq storefront/portal emas.

## Hozirgi holat — qayta ishlatilishi kerak bo'lgan mavjud narsalar

| Narsa | Fayl | Holat |
|---|---|---|
| Desktop POS UI | `apps/web/app/(dashboard)/pos/page.tsx` | Ishlab turgan, brauzerda |
| Mobil POS UI | `apps/web/app/m/pos/page.tsx` | Ishlab turgan, mobil PWA sifatida |
| Chek printeri/kassa qutisi/tarozi (BT) | `apps/web/lib/bt-printer.ts` | Web Bluetooth, ESC/POS, shu sessiyada qurilgan |
| Shtrix-kod (HID+kamera+Serial) | `apps/web/lib/scanner.ts` | Ishlab turgan, `useBarcodeScanner` + `openSerialScale` |
| Auth model | JWT access/refresh + `X-Organization-Id` header | O'zgarmaydi — client-qatlam qarori backend'ga tegmaydi |

**Muhim texnik haqiqat (vazifa ta'rifida ko'tarilgan savolga aniq javob)**: Web Bluetooth
(printer/kassa qutisi/tarozi) va Web Serial (ba'zi tarozilar) — bular **faqat Chromium**
API'lari. Apple'ning WebKit (Safari, va iOS'dagi BARCHA brauzer — Chrome iOS ham ichida
WebKit ishlatadi, Apple qoidasi) bu ikkisini ham amalga oshirmagan va yaqin kelajakda
qo'shish rejasi yo'q. Demak: **iOS'da plain native WebView (UIWebKit/WKWebView) orqali veb-
ilovani ochish — Bluetooth uskuna funksiyasini avtomatik yo'qotadi**, xuddi bugungi iOS
Safari'da bo'lgani kabi. Bu cheklov pastda har bir iOS variant uchun alohida ko'rsatiladi.

## Variant tahlili — A) Desktop, Linux ustuvor

| Mezon | Electron | Tauri |
|---|---|---|
| Runtime | To'liq Chromium bundle (har OS'da bir xil) | Tizim webview: Windows=WebView2 (Chromium), macOS/**Linux=WebKitGTK** |
| Bundle hajmi | ~150-200 MB | ~5-15 MB |
| Xotira (ishga tushganda) | ~200-400 MB | ~50-150 MB |
| Toolchain | Faqat JS/TS — jamoa allaqachon biladi | JS/TS + **Rust** (yangi til, cargo build) |
| Web Bluetooth/Serial (Linux'da) | ✅ Ishlaydi (Chromium) | ❌ **Ishlamaydi** — WebKitGTK bu API'larni amalga oshirmagan |
| Native menyu/tray/notification | Pishgan (electron-builder) | Pishgan, lekin kichikroq ekotizim |
| Auto-update | `electron-updater` — keng tarqalgan | Tauri o'z updater'i — kamroq production misoli |
| Linux paketlash | `.deb`/`.AppImage`/`.rpm` (electron-builder) | `.deb`/`.AppImage`/`.rpm` (tauri-bundler) |
| Kod qayta ishlatish | `apps/web`ni deyarli o'zgarishsiz `BrowserWindow`da ochish mumkin | UI xuddi shunday ochiladi, **lekin** `bt-printer.ts`/`scanner.ts` Linux'da ishlamaydi — Rust tomonida `btleplug` kabi crate + JS↔Rust IPC bridge yozish kerak bo'ladi (haqiqiy, kamaytirilmagan qo'shimcha ish) |

**Muhim tuzatish**: vazifa ta'rifida "Electron/Tauri Linux desktopda odatda Chromium orqali
Web Bluetooth'ni qo'llaydi" degan taxmin bor edi — bu **faqat Electron uchun to'g'ri**. Tauri
o'zining "kichik bundle" afzalligini aynan shundan oladi: u Chromium'ni o'zi bilan olib
yurmaydi, tizimning WebView'idan foydalanadi — Linux'da bu WebKitGTK, Web Bluetooth'ni
qo'llamaydi. Bu loyihaning aynan hardware ehtiyojiga zid bo'lgan muhim nuance.

## Variant tahlili — B) Mobile, iOS ustuvor

| Mezon | Native Swift/SwiftUI | React Native | Capacitor | PWA (hozirgi veb, o'rnatiladigan) |
|---|---|---|---|---|
| Mac/Xcode talabi | ✅ Shart (build+signing) | ✅ Shart (oxirgi bosqich) | ✅ Shart (oxirgi bosqich) | ❌ Kerak emas |
| Apple Developer Program ($99/yil) | ✅ Shart | ✅ Shart | ✅ Shart | ❌ Kerak emas |
| `apps/web` kod qayta ishlatish | Yo'q — to'liq qayta yozish | Past — UI RN komponentlariga qayta yoziladi, logika qisman | Yuqori — mavjud React/Next UI deyarli o'zgarishsiz webview'da ochiladi (static-export moslashtirish bilan) | Eng yuqori — o'zgarishsiz |
| Bluetooth (printer/drawer/tarozi) | ✅ To'liq (CoreBluetooth, noldan Swift kodi) | ⚠️ Community/native-module kerak | ⚠️ Community plugin (`@capacitor-community/bluetooth-le`, CoreBluetooth'ni o'raydi) — `bt-printer.ts`dagi Web Bluetooth kodi ISHLAMAYDI, alohida native-plugin chaqiruv qatlami yoziladi | ❌ Ishlamaydi (WKWebView = WebKit, Electron emas) |
| Kamera-skaner | ✅ AVFoundation (qayta yoziladi) | ✅ | ✅ (getUserMedia WKWebView'da ishlaydi) | ✅ (bugun ham ishlaydi) |
| App Store orqali tarqatish | ✅ | ✅ | ✅ | ❌ (faqat Safari "Home Screen'ga qo'shish") |
| Effort (nisbiy) | Eng katta | Katta | O'rta | Eng kichik |

## Acceptance criteria (Given/When/Then) — bu SPEC uchun "bajarildi" mezoni

**Scenario 1: Linux desktop + Electron — Bluetooth ishlaydi, kod o'zgarishsiz**
- **Given** Electron qobig'i `apps/web` POS sahifasini Chromium webview'da ochadi
- **When** kassir "chekni chop etish" tugmasini bosadi (mavjud `bt-printer.ts::printReceipt()`)
- **Then** Web Bluetooth chaqiruvi muvaffaqiyatli ishlaydi — hech qanday hardware-qatlam kodi
  qayta yozilmaydi (Electron = Linux'da ham to'liq Chromium)

**Scenario 2: Linux desktop + Tauri (agar tanlansa) — Bluetooth ISHLAMAYDI**
- **Given** Tauri qobig'i Linux'da WebKitGTK (tizim webview) ishlatadi
- **When** xuddi shu `bt-printer.ts` kodi chaqiriladi
- **Then** `navigator.bluetooth` `undefined` — chop etish/kassa qutisi/tarozi funksiyasi
  ISHLAMAYDI, Rust-tomonidagi alohida Bluetooth plugin + JS↔Rust bridge yozilmaguncha

**Scenario 3: iOS, plain native WebView (eng arzon "wrapper"), bridge kodisiz**
- **Given** iOS ilova faqat `apps/web`ni WKWebView ichida ochadi, qo'shimcha native kod yo'q
- **When** kassir Bluetooth printerga ulanishga harakat qiladi
- **Then** `navigator.bluetooth` mavjud emas — chop etish/kassa qutisi/tarozi funksiyasi
  YO'QOLADI (bugungi iOS Safari bilan AYNAN bir xil cheklov, hech narsa yaxshilanmaydi)

**Scenario 4: iOS + Capacitor + community Bluetooth plugin**
- **Given** Capacitor ilovaga `@capacitor-community/bluetooth-le` qo'shilgan
- **When** kassir printerga ulanadi
- **Then** CoreBluetooth native plugin orqali ishlaydi — LEKIN bu alohida, parallel
  integratsiya qatlami (`bt-printer.ts` ichidagi kod emas, yangi native-plugin chaqiruv kodi)

**Scenario 5: Egasi qaror qabul qilish nuqtasi (bu hujjatning yakuniy holati)**
- **Given** bu SPEC yozilgan, variantlar va tavsiya taqdim etilgan
- **When** egasi pastdagi "Ochiq savollar" bo'limiga javob beradi va texnologiyani tasdiqlaydi
- **Then** `architect` DESIGN.md yozishni boshlaydi, undan keyin PM yangi prefiksli
  implementatsiya ticketlarini ochadi — **bu hujjatning o'zi hech qanday amalga oshirishni
  boshlamaydi**

## Talablar (RFC 2119) — keyingi bosqich uchun ko'rsatma (kod emas)

- **MUST**: Tanlangan yondashuv qaysi bo'lmasin, mavjud backend API (`apps/api`) kontrakti
  o'zgartirilmasin — bu sof client-qatlam qarori, backend bir xil JWT+org-header model bilan
  xizmat qiladi.
- **MUST**: Chromium-asosidagi har qanday variant (Electron har qanday OS'da, Tauri faqat
  Windows'da) uchun mavjud `bt-printer.ts`/`scanner.ts` kodi QAYTA YOZILMASIN — to'g'ridan-
  to'g'ri qayta ishlatilsin.
- **MUST NOT**: Bu SPEC fazasida hech qanday loyiha skeleton (Electron/Tauri package,
  Xcode project, Capacitor config) yaratilmasin — faqat egasi tasdiqlagandan keyin.
- **SHOULD**: Tanlangan desktop/mobil qobiq mavjud JWT access/refresh + `X-Organization-Id`
  oqimini o'zgarishsiz qayta ishlatsin — yangi auth protokoli yozilmasin.
- **MAY**: Agar kelajakda Android qo'shilsa (pastda Ochiq savol #1), iOS uchun tanlangan
  Capacitor/React Native kodeki Android'ga deyarli bepul ko'chadi (Android WebView — Chromium
  asosida, Web Bluetooth ham muammosizroq) — bu hozircha MAY, hal qilinmagan.

## Tavsiya (biz tavsiya qilamiz — bu qaror EMAS, egasi tasdiqlashi kerak)

- **Desktop (Linux): Electron**, Tauri emas. Sabab: Web Bluetooth/Web Serial'ni o'zgarishsiz
  qayta ishlatish imkonini beradigan yagona variant; jamoa allaqachon JS/TS'ni biladi, yangi
  Rust toolchain kerak emas; auto-update va Linux paketlash ekotizimi pishgan. Bundle/xotira
  hajmi katta bo'lsa-da, POS terminal kompyuteri resurs-cheklangan qurilma emas — bu real
  muammo emas. Tauri faqat shu narx (Rust'da Bluetooth qatlamini qayta yozish) qabul
  qilinsa ko'rib chiqilishi mumkin.
- **iOS: Capacitor**, to'liq native Swift ham, sof PWA ham emas (V1 uchun). Sabab: mavjud
  `apps/web` React/Next kodining katta qismini qayta ishlatadi (to'liq Swift qayta yozishdan
  arzonroq), App Store orqali tarqatishga imkon beradi (PWA bermaydi), va community plugin
  orqali HAQIQIY Bluetooth uskunaga yo'l ochadi (PWA bermaydi). Narxi: baribir Mac/Xcode
  bosqichi kerak, va Next.js App Router'ni static-export'ga moslashtirish kerak bo'ladi.
  PWA — agar Ochiq savol #5'ga javob "Bluetooth shart emas" bo'lsa, eng arzon muqobil sifatida
  qoladi. To'liq native Swift — faqat egasi aniq strategik sabab (masalan "App Store'da
  haqiqiy native" pozitsiyasi) ko'rsatsa tavsiya etiladi, V1 uchun emas.

## QILMAYMIZ (qamrov-tashqarisida)

- ❌ Android ilova — so'rovda faqat Linux desktop + iOS aytilgan, Android SO'RALMAGAN (pastda
  Ochiq savol #1'da bayroq qilingan — ehtimol unutilgan, chunki O'zbekiston chakana savdo
  uskunalari ko'pincha Android-asosida).
- ❌ Haqiqiy kod/loyiha skeleton (Electron `package.json`, Xcode loyihasi, Capacitor config,
  CI pipeline) — bu SPEC faqat variant tahlili, implementatsiya emas.
- ❌ Windows desktop ilova — so'rovda faqat Linux so'ralgan (Electron texnik jihatdan
  Windows'da ham bepul ishlaydi, lekin bu safar scope'ga ataylab kiritilmaydi).
- ❌ App Store / (Linux uchun) Snap Store / Flathub listing jarayoni — distribution
  logistikasi, texnologiya tanlovidan keyingi, mustaqil bosqich.
- ❌ Offline-first/sync arxitekturasi desktop/mobil uchun — agar kerak bo'lsa, mavjud
  `tickets/SPEC-pos-offline.md` qamrovidan alohida; bu SPEC faqat "brauzer o'rniga native
  qobiq, bir xil online rejim" ni ko'rib chiqadi.
- ❌ Auto-update server infratuzilmasi (masalan xususiy update-server)ni sozlash — faqat
  mavjud tooling (electron-updater va h.k.) borligi qayd etiladi, server qismi keyingi
  ticketda.

## Risklar (yashirilmaydi)

- **Tauri Linux'da Chromium emas, WebKitGTK ishlatadi** — agar bu farq e'tiborga olinmasa va
  "kichik bundle" afzalligi uchun Tauri tanlansa, aynan loyihaning hardware ehtiyoji (Bluetooth
  printer/kassa qutisi/tarozi) buziladi — bu eng katta texnik tuzoq.
- **Mac build mashinasi yo'qligi** (hozirgi muhit — Windows) — iOS yo'lining BARCHA
  variantlarida (hatto Capacitor/RN'da ham) oxirgi bosqich (build + code signing) uchun
  SHART. Bu butun iOS yo'nalishini belgilovchi eng katta tashqi bog'liqlik — hal qilinmaguncha
  iOS tomondagi har qanday ish rejasi "bloklangan" hisoblanadi.
- **Apple Developer Program** ($99/yil) + App Store review jarayoni (noma'lum muddat, rad
  etish ehtimoli) — vaqt rejasiga ta'sir qiladi, PM bu safar muddat taxminini bermaydi
  (Ochiq savol #4).
- **Ikki (yoki uch, Android qo'shilsa) alohida kodbaza/build pipeline** — uzoq muddatli
  qo'llab-quvvatlash yuki. Capacitor tanlansa bu yuk nisbatan kam (bitta UI kodbaza), to'liq
  native Swift tanlansa eng katta (butunlay mustaqil ikkinchi frontend abadiy saqlanadi).
- **`bt-printer.ts` protokoli hali real qurilmada to'liq tasdiqlanmagan** (`tickets/SPEC-pos-
  hardware.md` Risklar bo'limida ham qayd etilgan — grep bo'yicha hech qayerda production'da
  ishlatilmagan). Desktop/mobil qobiq aynan shu tasdiqlanmagan negiz ustiga quriladi — bu
  ikkilamchi tavakkal qatlami hosil qiladi.

## Ochiq savollar (egasi uchun, bu SPEC tasdiqlanishidan OLDIN)

1. **Android ham kerakmi?** So'rovda faqat "Linux desktop + iOS" aytilgan, Android telefon
   yo'q — bu g'ayrioddiy, chunki O'zbekiston chakana savdo uskunalarining katta qismi
   Android-asosida ishlaydi (va Android — Chromium WebView tufayli Web Bluetooth bilan ancha
   arzonroq ishlaydi, iOS'dan farqli). Bu ataylab shundaymi (masalan faqat iOS mijoz/demo
   uchun kerak), yoki talabda unutilganmi?
2. **iOS build uchun Mac mashina/CI mavjudmi** (masalan GitHub Actions macOS runner, yoki
   MacStadium/MacinCloud kabi bulut-Mac ijara xizmati), yoki bu alohida topilishi/sotib
   olinishi kerakmi? Bu butun iOS yo'nalishining eng katta bloker-tavakkali — javobsiz holda
   keyingi bosqich (DESIGN) ham to'liq rejalashtirila olmaydi.
3. **BITTA umumiy kodbaza (desktop+mobil) kerakmi, yoki ikki alohida stack qabul
   qilinadimi?** (Masalan Capacitor texnik jihatdan Linux desktopda ham ishlaydi — Electron
   o'rnini bosishi mumkin, bitta kodbaza bilan ikkalasini ham qoplash variantini ochadi,
   lekin bu alohida chuqur tahlil talab qiladi, bu SPEC hajmidan tashqarida.)
4. **Byudjet/muddat kutilmasi qanday?** Bu to'g'ridan-to'g'ri texnologiya tanlovini
   belgilaydi: native Swift — oylar, Capacitor — haftalar, PWA — kunlar.
5. **iOS'da HAQIQIY Bluetooth uskuna (chek printeri/kassa qutisi/tarozi) ishlashi
   MAJBURIYMI, yoki V1'da faqat ekran/dastur (hardware'siz, keyinroq qo'shiladigan) etarli?**
   Javob "ha, majburiy" bo'lsa — PWA variant butunlay chiqib ketadi, Capacitor (plugin bilan)
   yoki to'liq native shart bo'lib qoladi.

## Rollback rejasi

Qo'llanilmaydi — bu bosqichda hali kod yozilmagan. Texnologiya tanlanib, implementatsiya
boshlangandan keyin rollback rejasi tegishli `DESIGN.md`'da yoziladi.

## Tegishli modullar (referens, o'zgartirilmagan)

- `apps/web/app/(dashboard)/pos/page.tsx` — desktop POS UI
- `apps/web/app/m/pos/page.tsx` — mobil POS UI
- `apps/web/lib/bt-printer.ts` — Web Bluetooth printer/kassa qutisi/tarozi
- `apps/web/lib/scanner.ts` — HID-wedge + WebSerial + kamera skaner
- `apps/web/components/barcode/scanner.tsx` — kamera-asosidagi `BarcodeDetector`/zxing
- `apps/web/package.json` — hozirda Electron/Tauri/Capacitor/React Native bog'liqliklari
  YO'Q (tekshirildi) — bu to'liq yangi qo'shimcha, mavjud qurilishga ta'sir qilmaydi
- `tickets/SPEC-pos-hardware.md` — mavjud Bluetooth/Serial uskuna integratsiyasi SPEC'i,
  referens/bog'liq kontekst

## O'zbek bozori xosligi

- **OFD**: ✗ tegmaydi (bu sof client-qobiq qarori)
- **MXIK**: ✗ tegmaydi
- **QQS**: ✗ tegmaydi
- **TIN/STIR**: ✗ tegmaydi
- **SMS (Eskiz)**: ✗ tegmaydi
- **To'lov**: ✗ tegmaydi
- **Qurilma bozori**: ⚠️ bevosita bog'liq — O'zbekiston chakana savdoda keng tarqalgan
  uskunalar ko'pincha Android-asosida (Ochiq savol #1), Linux POS-terminal va iOS esa
  nisbatan kamroq uchraydi — bu tanlovning amaliy ROI'siga ta'sir qiladi, egasi hal qilishi
  kerak.

## Effort estimation (taxminiy, faqat tegish — ticketlar ochilmaguncha aniqlashtirilmaydi)

- Desktop Electron (Linux): S-M — mavjud veb-ilovani qobiqqa o'rash + paketlash, hardware kod
  o'zgarishsiz
- Desktop Tauri (agar tanlansa): M-L — qobiq o'zi kichik, lekin Rust Bluetooth qatlamini
  noldan yozish qo'shiladi
- iOS Capacitor: M-L — UI static-export moslashtirish + Bluetooth plugin integratsiyasi +
  Mac/Xcode bog'liqligi (tashqi omil, ichki effort emas, lekin muddatga ta'sir qiladi)
- iOS native Swift: XL — to'liq ikkinchi frontend, noldan Bluetooth/kamera kodi
- iOS PWA: XS — deyarli tayyor (`apps/web/m/`), manifest + service worker qo'shish kifoya,
  lekin Bluetooth yo'qoladi

## Keyingi qadam (bu safar BOSILMAYDI)

Egasi yuqoridagi "Ochiq savollar"ga javob berib, bitta texnologiya yo'nalishini (desktop +
mobil) tasdiqlagandan keyin:
1. `architect` → `DESIGN.md` (tanlangan stack uchun aniq loyiha tuzilishi, build pipeline,
   kod-qayta-ishlatish rejasi)
2. `pm` → yangi prefiksli implementatsiya ticketlari (masalan `DT-*` desktop, `MT-*` mobil)
   — **BU SPEC DOIRASIDA OCHILMAYDI**
