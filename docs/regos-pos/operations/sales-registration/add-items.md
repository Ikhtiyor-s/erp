# Mahsulot qo'shish usullari

Manba: `docs.regos.uz/ru/regos-pos/operations/sales-registration/add-items`

REGOS'da savatga mahsulot qo'shishning **to'rt** usuli bor:

## 1. Shtrix-kod skanerlash

Avtomatik qo'shiladi (moslik topilsa). Agar bitta shtrix-kod bir nechta
SKU'ga mos kelsa (masalan variant mahsulotlar) — tanlash oynasi (disambiguation
popup) chiqadi.

**Aniq ERP holati:** ✅ bor — `useBarcodeScanner` (HID keyboard-wedge, POS-1,
2026-10-12). ⚠️ Disambiguation popup yo'q — bir nechta moslik topilsa birinchisi
avtomatik tanlanadi (`pos/page.tsx`dagi `data.find(...) || data[0]`).

## 2. Код номенкл. (`Ctrl+Shift+C`)

Alohida "raqamli kod kiritish" rejimiga o'tadi — kassir mahsulot kodini
to'g'ridan-to'g'ri kiritadi, `Enter` bosilganda qo'shiladi. Klaviaturasiz,
tezkor kiritish uchun (ayniqsa raqamli kodlar katalogida).

**Aniq ERP holati:** ❌ yo'q. O'xshash funksiya — qidiruv maydoniga SKU
yozish — bor, lekin alohida "rejim" emas, oddiy filtrlangan ro'yxat.

## 3. Поиск (`F3`)

Popup qidiruv — kod/artikul/nom/shtrix-kod (to'rttasi alohida yoqib/
o'chirib bo'ladi) bo'yicha. Natijani tanlab, `Enter`/`OK` bosilsa qo'shiladi.
Har bir ombordagi qoldiq ham shu oynada ko'rinadi (yon tugma orqali).

**Aniq ERP holati:** ⚠️ Qisman. `pos/page.tsx`dagi qidiruv maydoni (F3
hotkey endi uni fokus qiladi, 2026-10-13 qo'shildi) — lekin bu **modal popup
emas**, oddiy jonli-filtrlangan grid. Kod/artikul/nom/shtrix-kod bo'yicha
alohida yoqish-o'chirish yo'q (barchasi bitta qidiruv satriga tushadi).
Ombordagi qoldiq ko'rsatiladi (`total_stock`), lekin faqat tanlangan
ombor uchun, "boshqa ombordagi qoldiq" ko'rinishi yo'q.

## 4. Подбор номенклатуры (`Ctrl+F3`)

Kategoriya bo'yicha ko'rib chiqish — chapda guruhlar, o'ngda shu guruhdagi
mahsulotlar. Bitta-marta bosib + OK = bitta qo'shadi va oynani yopadi;
**ikki marta bosish** = yopmasdan ketma-ket qo'shadi (tez ko'p-qo'shish
uchun).

**Aniq ERP holati:** ❌ yo'q. Kategoriya bo'yicha ko'rib chiqish POS ekranida
mavjud emas (faqat qidiruv orqali).

## Variant mahsulotlar

Agar mahsulot variantlarga ega bo'lsa (masalan futbolka — rang/o'lcham),
qo'shishda variant tanlash oynasi chiqadi.

**Aniq ERP holati:** ❌ POS ekranida variant tanlash oqimi yo'q.

## Belgilangan tovarlar (O'zbekiston majburiy markirovka rejimi)

"Подлежит маркировке" deb belgilangan tovarlar uchun:
- QR markirovka kodini skanerlash — avtomatik qo'shiladi.
- Oddiy shtrix-kod skanerlansa — markirovka kodini qo'lda kiritish oynasi
  chiqadi, klaviatura avtomatik inglizcha rejimga o'tadi (skanerlash uchun),
  keyin qaytadi.
- Belgilangan tovarlar **har doim qty=1** bilan qo'shiladi — bir xil tovarni
  qayta skanerlash miqdorni oshirmaydi, **alohida yangi qator** yaratadi
  (har bir dona o'zining noyob markirovka kodi bilan kuzatiladi).

**Aniq ERP holati:** ❌ Butunlay yo'q. Qiziq nuans: ma'lumotlar bazasida
`mxik` ustuni mahsulot jadvalida allaqachon bor (soliq/mahsulot
klassifikatori uchun) — ya'ni sxema markirovka rejimidan umuman bexabar
emas, lekin POS'ning qo'shish oqimi bu rejimni hisobga olmaydi. **Agar
Aniq ERP mijozlari dori-darmon, alkogol, tamaki, poyabzal kabi
markirovka-majburiy toifalarda savdo qilsa — bu haqiqiy muvofiqlik
(compliance) bo'shlig'i**, shunchaki UX qulayligi emas.

**Keyingi qadam:** hozircha ticketlanmagan. Agar mijozlar segmentida
markirovka-majburiy toifalar bo'lsa, bu alohida va ancha jiddiy (huquqiy
talab) ticket bo'lishi kerak — faqat UX emas.
