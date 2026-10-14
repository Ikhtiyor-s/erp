# REGOS — merchant-admin mobil ilova (kassir ekrani EMAS)

> Manba: `online.regos.app` v1.2.18 (build 30) Android APK, statik tahlil —
> `D:\Docker\projects\cloner\downloads\regos_apk\` (Anthropic "Cloner" vositasi
> orqali decompile qilingan, 2026-10-14). Bu `docs/regos-pos/`dagi boshqa
> fayllardan farqli: ular `docs.regos.uz` rasmiy hujjatlaridan (kassir ekrani),
> bu fayl esa REGOS'ning **alohida, savdogar/egasi uchun mobil ilovasi**dan
> (business-owner/manager remote monitoring) — ikkisi bir xil kompaniya, ikki
> xil ilova sirti. `docs/pospoint-pos/` bilan kesishish yo'q — u faqat
> pospoint.uz veb-saytidan olingan, mobil ilova tahlil qilinmagan.

## ⚠️ Ishonchlilik darajasi — avval shuni o'qing

Bu hujjat **docs.regos.uz rasmiy hujjatlaridan emas** — tескирилган APK'dan
qayta tiklangan (reverse-engineered). Muhim cheklov: ilova React Native +
Hermes bytecode'da (`index.android.bundle.js`, 1.4 MB, source map **yo'q**).
Hermes bytecode'ni to'g'ri disassemble qilish uchun rasmiy `hbcdump` vositasi
kerak — bu muhitda mavjud emas (Cloner vositasining o'zi ham `analysis/
SUMMARY.md`da buni ochiq qayd etgan: "hbcdump kerak"). Shu sababli:

- ✅ **Yuqori ishonch**: `AndroidManifest.xml`, `app.config` (Expo konfiguratsiya
  JSON, oddiy matn holida), native resurslar (`strings.xml`), bildirishnoma
  tovush fayllari nomlari, bytecode ichidan topilgan aniq URL/domen satrlari —
  bularning barchasi **oddiy matn holida**, hech qanday taxmin kerak emas.
- ⚠️ **O'rtacha ishonch**: bildirishnoma tovush fayli nomidan funksiya nomini
  xulosa qilish (masalan `deal_notify.wav` → CRM/"bitim" funksiyasi bor degan
  xulosa) — mantiqiy, lekin ekranning o'zi ko'rilmagan.
- ❌ **Aniqlab bo'lmadi**: ekranlar ro'yxati, navigatsiya tuzilishi, UI
  matnlari (tugma nomlari, sarlavhalar) — chunki (pastda tushuntirilgan sababga
  ko'ra) ular bu APK faylining ichida **umuman yo'q**.

## Eng muhim arxitektura xulosasi: bu "to'liq native ilova" emas

Ilova ichida UI matni (o'zbekcha/ruscha yorliqlar, ekran sarlavhalari) qidirib
topilmadi — na Hermes bytecode ichida (ASCII va Kirill-UTF8 ikkalasi ham maxsus
skript bilan qidirildi), na Android `strings.xml`da (faqat umumiy
AndroidX/Material/Google-kutubxona satrlari bor, REGOS'ga xos matn yo'q).
Buning sababi aniq topildi: ilova UI matnlarini **runtime'da serverdan**
oladi — bytecode ichida `https://api.regos.uz/v1/Language/get` chaqiruvi va
`https://cdn.regos.uz/updater/lang/mobile` manzili bor. Bundan tashqari,
bytecode ichida `window.__regosTextSelectionDisabled` va
`window.__REGOS_NATIVE_KEYBOARD_INSET__` kabi **WebView'ga in'ektsiya
qilinadigan JS ko'priq o'zgaruvchilari** topildi (`react-native-webview`
komponenti 11 marta ishlatilgan) — bu shuni ko'rsatadiki, ilovaning asosiy
biznes-ekranlari (hisobot, sotuv ro'yxati va h.k.) **mahalliy React Native
komponentlari sifatida emas, balki REGOS veb-ilovasini WebView ichida
ko'rsatish orqali** amalga oshirilgan ehtimoli yuqori. Native (RN) qism esa
quyidagilarni ta'minlaydi: push-bildirishnoma, kamera-skaner, ilova
belgisi (badge), deep-link, splash screen — "qobiq" vazifasini bajaradi.

**Bu nima uchun muhim**: bu — `tickets/SPEC-desktop-mobile-apps.md`dagi
texnologiya tanlovi uchun real-dunyo precedent. REGOS xuddi o'sha SPEC'da
iOS uchun tavsiya etilgan yondashuvni (Capacitor — mavjud veb-ilovani
native qobiqqa o'rab, ustiga native plaginlar qo'shish) amalda qo'llagan,
faqat Capacitor o'rniga Expo/React-Native + ichki WebView kombinatsiyasidan
foydalangan. To'liq-native qayta yozish emas.

## Backend arxitekturasi haqida topilgan dalillar

| Dalil | Qiymat |
|---|---|
| Auth server | `auth.regos.uz` |
| API server | `api.regos.uz` — `/v1/Language/get` kabi PascalCase resurs/amal nomlanishi (`.NET`/C#-uslubidagi backend konventsiyasiga o'xshaydi, lekin bu **taxmin**, tasdiqlanmagan) |
| Yangilanish/CDN | `cdn.regos.uz/updater/mobile`, `cdn.regos.uz/updater/lang/mobile` |
| Autentifikatsiya usuli | Cloner vositasining o'z tahlili (`analysis/api_endpoints.json`): maxsus `Token`/`token` header — standart `Authorization: Bearer` **emas**. Aniq ERP JWT `Authorization: Bearer` + `X-Organization-Id` header ishlatadi — ikkisi boshqa-boshqa yondashuv, bu normal, REGOS'niki "noto'g'ri" degani emas. |
| Deep link | `exp+regos://` (Expo standart sxemasi) |

## Bildirishnoma (push) toifalari — aniqlangan funksiya xaritasi

`app.config`dagi `expo-notifications` plagin konfiguratsiyasida 8 ta tovush
fayli ro'yxatlangan — bu **eng ishonchli, to'g'ridan-to'g'ri fayl nomidan
o'qilgan** dalil (xulosa emas, haqiqiy konfiguratsiya):

| Tovush fayli | Xulosa qilingan funksiya | Ishonch |
|---|---|---|
| `notify.wav` | Umumiy bildirishnoma | Yuqori (standart nom) |
| `not_found.wav` | Shtrix-kod skanerlanganda "mahsulot topilmadi" | O'rtacha |
| `chat_notify.wav`, `chat_notify2.wav`, `chat_notify3.wav` | **Chat** (suhbat/xabar almashish) — 3 xil tovush borligi bu funksiya faol va ehtimol tez-tez ishlatilishini ko'rsatadi | O'rtacha-yuqori |
| `deal_notify.wav` | **"Bitim" (Deal) — CRM/savdo-voronkasi** funksiyasi | O'rtacha |
| `task_notify.wav` | **Vazifa (Task) boshqaruvi** | O'rtacha-yuqori (Aniq ERP'da ham mos modul bor — pastga qarang) |
| `ticket_notify.wav` | **Qo'llab-quvvatlash tiketi (support ticket)** | O'rtacha — diqqat, bu "restoran stoli cheki" emas, pastdagi "Aniq ERP holati"da bu farq aniqlashtirilgan |

## Ruxsatlar va texnik imkoniyatlar (AndroidManifest'dan)

- `CAMERA` + Google ML Kit shtrix-kod modeli (`barcode_ssd_mobilenet_v1_dmp25_quant.tflite` qurilmaga oldindan o'rnatilgan) — **qurilmada, oflayn** shtrix-kod aniqlash, faqat kamera oqimi emas.
- `POST_NOTIFICATIONS` + Firebase Cloud Messaging + Expo Notifications — to'liq push-bildirishnoma infratuzilmasi.
- Juda ko'p ishlab chiqaruvchi-maxsus "badge" ruxsatlari (Samsung, HTC, Sony, Huawei, Oppo) — ilova belgisida son ko'rsatish (masalan "3 ta o'qilmagan") turli Android launcher'larda ishlashi uchun.
- `Google Sign-In` kutubxonasi mavjud (`common_signin_button_text_long`: "Sign in with Google") — Google orqali kirish imkoniyati bor ehtimol.
- ❌ Bluetooth, ❌ Biometrik autentifikatsiya, ❌ Oflayn rejim, ❌ Chek printeri — bularning birortasiga ishora topilmadi (kod ichida "bluetooth"/"biometric"/"offline"/"Print" so'zlari qidirildi, deyarli hech narsa chiqmadi). Bu kutilgan — bu kassir-POS ilovasi emas, egasi/menejer uchun masofaviy kuzatuv ilovasi, chek chop etish uning vazifasi emas.

## Aniq ERP holati — har bir aniqlangan funksiya bo'yicha

### Push-bildirishnoma (umumiy infratuzilma)

**Aniq ERP holati:** ⚠️ qisman — faqat yarim qurilgan. `apps/api/app/modules/
mobile/router.py`da `push_tokens` jadvali + `POST`/`DELETE` ro'yxatga
olish endpointlari bor (`register_push_token`/`unregister_push_token`,
qator ~1155), lekin **hech qanday joyda bu tokenlarga haqiqatan push
yuborilmaydi** — butun repo bo'yicha qidiruv (`push_tokens`, `send_push`,
`fcm`, `expo.*push`) faqat shu bitta faylda va `schema_patches.py`da
(ustun ta'rifi) topildi, hech qanday "yuborish" logikasi yo'q. Bu xuddi shu
sessiyada avval topilgan "tug'ilgan kun SMS shabloni bor, lekin uni
yuboradigan hech narsa yo'q" naqshining xuddi o'zi (`docs/pospoint-pos/
operations/customers.md`ga qarang) — infratuzilma qurilgan, lekin
"so'nggi metr" ulanmagan.

### Vazifa (Task) boshqaruvi

**Aniq ERP holati:** ✅ bor — `apps/api/app/modules/tasks/router.py`
(`/tasks` prefiksi) + veb-dashboard'da "Задачи" bo'limi (`lib/
menu.config.ts`). Mobil PWA'da alohida sahifa sifatida yo'q edi (tekshirilganda
`apps/web/app/m/` papkasida `tasks` yo'q — faqat desktop dashboard'da).

### Chat / suhbat

**Aniq ERP holati:** ❌ Yo'q (to'g'ridan-to'g'ri mos keladigan ma'noda).
`apps/api/app/modules/assistant/router.py`da `/chat` endpointi bor, lekin
bu **AI-yordamchi chati** (Claude/OpenAI backend bilan) — odam-odamga yoki
xodim-mijoz suhbat funksiyasi emas. REGOS'ning "Chat" push-toifasi
(3 xil tovush bilan, ehtimol tez-tez ishlatiladigan funksiya) uchun Aniq
ERP'da haqiqiy ekvivalent yo'q.

### "Bitim" (Deal) / CRM-voronka

**Aniq ERP holati:** ❌ Yo'q. `customer`/`marketing` modullarida mijozlar
bazasi, ABC-tahlil, chegirmalar bor, lekin "bitim" (deal/lead) tushunchasi —
bosqichlardan iborat savdo-voronkasi (masalan "Aloqa → Taklif →
Muzokara → Yopildi") — kodda hech qayerda topilmadi. Bu To'liq yangi
funksiya klassi bo'lardi.

### Qo'llab-quvvatlash tiketi (support ticket)

**Aniq ERP holati:** ❌ Yo'q — **muhim atama chalkashligi**: Aniq ERP'da
`/open-tickets` degan endpoint bor (`mobile/router.py`, qator ~613), lekin
bu REGOS'ning support-tiketi EMAS — bu **kafe/restoran stol-cheki**
("ochiq ticket" = stolga ochilgan, hali yopilmagan hisob-kitob hujjati,
`docs/regos-pos/`dagi boshqa fayllarda ham shu ma'noda ishlatilgan). Ikkala
tizim ham "ticket" so'zini ishlatadi, lekin butunlay boshqa narsalarni
anglatadi. Haqiqiy qo'llab-quvvatlash/murojaat-tiketi tizimi Aniq ERP'da
yo'q.

### Masofaviy "bir qarashda" sotuv ko'rinishi (mobil bosh ekran)

**Aniq ERP holati:** ✅ qisman-yaxshi holatda — kutilganidan yaxshiroq.
`apps/web/app/m/page.tsx` — bugungi sotuvlar soni/summasi + ochiq
ticketlar soni (karta ko'rinishida) + POS/Sotuvlar/Mijoz/Sklad/Moliya/
Vizit/Kuryer'ga tezkor o'tish tugmalari. Bu **mazmun jihatidan** REGOS
merchant-ilovasining "bir qarashda holat" ekraniga juda yaqin — faqat
**yetkazish usuli** boshqa: Aniq ERP'da bu brauzer-asosidagi PWA
(`apps/web/app/m/*`), push-bildirishnoma bilan qayta jalb qilish
(re-engagement), ilova belgisi (home-screen icon), fon rejimida ishlash
imkoniyatisiz. Ya'ni: **ma'lumot/ekranlar deyarli bor, "native ilova"
qobig'i yo'q** — bu xuddi yuqoridagi arxitektura xulosasini tasdiqlaydi va
`tickets/SPEC-desktop-mobile-apps.md`dagi ochiq savollarga bevosita
tegishli.

### Shtrix-kod skanerlash (qurilmada, ML asosida)

**Aniq ERP holati:** ✅ bor, boshqa yondashuv bilan — `apps/web/lib/
scanner.ts` HID-wedge (tashqi skaner) + kamera (`BarcodeDetector`/zxing,
`components/barcode/scanner.tsx`) + WebSerial (tarozi) orqali ishlaydi.
REGOS'niki qurilmaga oldindan o'rnatilgan Google ML Kit modeli orqali —
funksional natija o'xshash (kamera orqali shtrix-kod o'qish), lekin
texnik yo'l boshqa (brauzer API vs native ML model). Ikkalasi ham ishlaydi
deb hisoblash mumkin, farq faqat amalga oshirish usulida.

## Keyingi qadam

Bu hujjat **xarita, ticket emas** (boshqa `docs/regos-pos/` fayllari kabi).
Eng aniq, kam-xavfli keyingi qadam: **push-bildirishnoma yuborish
qismini yakunlash** — `push_tokens` jadvali va ro'yxatga olish endpointi
allaqachon bor, faqat Expo Push API (`https://exp.host/--/api/v2/push/
send` — bu standart Expo xizmati, REGOS'ga xos emas) yoki Firebase orqali
yuborish logikasi yetishmayapti. Bu xuddi shu sessiyada topilgan
"tug'ilgan kun SMS shabloni ulanmagan" va "cashbox_session_id hech qachon
to'ldirilmagan" naqshlariga o'xshash — kichik, aniq, yuqori ta'sirli ish.

Chat va Deal/CRM-voronka — butunlay yangi funksiya klasslari, alohida
PM/architect bosqichi talab qiladi, past-o'rtacha ustuvorlik (faqat aniq
biznes-ehtiyoj tasdiqlansa). Haqiqiy support-tiket tizimi — o'rtacha
ustuvorlik, agar mijozlar hozir shunday so'rovlarni boshqa kanal (masalan
Telegram) orqali yuritayotgan bo'lsa.

**Eng muhim, kod-tashqarisidagi xulosa**: agar `tickets/
SPEC-desktop-mobile-apps.md` bo'yicha qaror qabul qilinsa, REGOS'ning
"WebView + native qobiq" yondashuvi real-dunyo precedent sifatida
ko'rib chiqilishi mumkin — ayniqsa SPEC'ning o'zi aynan shu yo'nalishni
(Capacitor, iOS uchun) tavsiya qilgan edi.
