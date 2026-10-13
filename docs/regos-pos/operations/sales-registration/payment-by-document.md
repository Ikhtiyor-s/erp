# To'lov ekrani

Manba: `docs.regos.uz/ru/regos-pos/operations/sales-registration/payment-by-document`

## Joylashuv (3-panel)

| Chap | Markaz | O'ng |
|---|---|---|
| Hozirgача to'lov qatorlari ro'yxati + navigatsiya/sторno boshqaruvi | Raqamli klaviatura | To'lov usuli tugmalari |

Yuqori satrda **5 ta raqam** ko'rsatiladi: **К оплате** (hujjat jami) /
**Оплачено** (hozirgacha to'langan) / **Доплата** (qolgan qarz) /
**Вносимая сумма** (hozir kiritilayotgan summa) / **Сдача** (qaytim, faqat
naqd).

## Mexanika

1. Kassir summani klaviaturada kiritadi (yoki 0 qoldiradi = "qolgan to'liq
   summa").
2. To'lov-usuli tugmasini bosadi (Наличные, Бонусы, yoki "Безналичные" остида
   UzCard/HUMO/ClickPASS/PaymeGO/UzumPay/AnorGo) — **shu zahoti bitta to'lov
   qatori yoziladi**.
3. Agar qarz qolgan bo'lsa, fokus avtomatik keyingi kiritishga qaytadi.
4. **Qaytim alohida "qaytim" maydoni emas** — agar naqd kiritilgan summa
   qarzdan ko'p bo'lsa, REGOS buni **xuddi shu to'lovlar ro'yxatiga,
   alohida MANFIY qatordek** qo'shadi.
5. Har bir to'lov qatori alohida **sторno** qilinishi mumkin (xuddi savat
   qatori kabi — `Delete`, audit-izi bilan). Sторno qilingan qator qayta
   sторno qilinmaydi.
6. **"Отложить оплату" (to'lovni kutish rejimiga qo'yish) faqat hali bitta
   ham to'lov qatori yozilmagan bo'lsa ishlaydi** — qisman to'lov qilingan
   bo'lsa, avval uni sторно qilish kerak.
7. **"Аннулировать"** (butun hujjatni bekor qilish) va **"Закрыть чек"**
   (yopish, faqat Доплата=0 bo'lganda yoqiladi) — ikkalasi ham shu ekranda
   mavjud.

## To'lov usullari

Наличные (naqd), Бонусы (ball), "Безналичные" остида: UzCard/HUMO
(terminal orqali, PAX/Ingenico), ClickPASS/PaymeGO/UzumPay/AnorGo (QR-kod
ЭПС ilovalari — har biri mijoz o'z ilovasida skanerlashini kutuvchi popup
ko'rsatadi).

**Muhim cheklov:** REGOS:VCR ulangan bo'lsa, **bitta chekda faqat BITTA
naqd-bo'lmagan to'lov qatoriga ruxsat beriladi** (REGOS'ning o'zining
"aralash to'lov" imkoniyati ham shu cheklov bilan).

## Aniq ERP holati

✅ **Asosiy model juda yaqin** (RG-7, 2026-10-12/13 sessiyasida qurilgan,
`pos/page.tsx`dagi `tapPayment()`): kassir summa kiritadi (yoki 0 = to'liq
qolgan summa), to'lov-usuli tugmasini bosadi — shu zahoti bitta `/pay`
chaqiruvi yuboriladi, qoldiq kamayadi.

Gaplar:

| REGOS | Aniq ERP |
|---|---|
| Qaytim — to'lovlar ro'yxatida manfiy qator | ⚠️ Alohida `lastChange` info-satri sifatida ko'rsatiladi, `committedLines`ga kirmaydi — kosmetik farq, lekin REGOS'ga to'liq mos emas |
| To'lov qatori sторnosi | ❌ Yo'q — `tapPayment`ning "oxirgi urinishni bekor qilish" ekvivalenti yo'q |
| "Аннулировать" (butun hujjatni bekor qilish) to'lov ekranida | ⚠️ `pos/page.tsx`dagi F9/F12 + "Chiqish" tugmasi bor, lekin bu faqat **frontend state**ni tozalaydi — agar `ensureSale()` allaqachon serverda sotuv yaratgan bo'lsa, backend'da haqiqiy "bekor qilingan" holatga o'tkazmaydi (chunki [`general-information.md`](general-information.md)da yozilganidek, bunday holat `sales.status`da yo'q) |
| "Отложить оплату" (faqat to'lov qatorlari 0 bo'lsa) | ❌ Yo'q — park/defer umuman yo'q |
| Bitta naqd-bo'lmagan to'lov cheklovi (VCR bilan) | — Aniq ERP'da hali hech qanday terminal (PAX/Ingenico) integratsiyasi yo'q, shuning uchun bu cheklov hozircha tegishli emas |
| To'lov usullari ro'yxati | ✅ `reference/payment-types`dan dinamik yuklanadi — Click/Payme/UzCard/HUMO kabi real provayderlar emas, balki tashkilot o'zi sozlagan `payment_type_id` qatorlari (ichki, haqiqiy to'lov provayder integratsiyasisiz — bu RG-2 ticketida ham alohida ta'kidlangan) |

**Keyingi qadam:** to'lov qatori sторnosi — [`general-information.md`](general-information.md)dagi
savat-qator sторnosi bilan birga, bitta umumiy "sторno/audit-trail" ticketi
sifatida qilingani ma'qul (ikkalasi bir xil naqsh). Park-mid-payment —
[`general-information.md`](general-information.md)dagi katta gap bilan birga.
