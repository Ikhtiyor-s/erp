# Moliya

Manba: `pospoint.uz/uz/knowledge-base/finance`

## PosPoint nima qiladi

Savdo nuqtasining pul oqimlari: kassa/seyf/bank qoldiqlari,
inkassatsiya, kirim/chiqim, tranzaksiya jurnali.

### Hisob qoldiqlari — 3-pog'onali

Uchta alohida hisob ko'rsatiladi:
- **Kassadagi naqd pul** — kassa qutisidagi naqd.
- **Naqd pul (Seyf)** — seyfga topshirilgan naqd (saqlash/inkassatsiya
  uchun).
- **Hisob-kitob raqami (Bank)** — bank hisobidagi naqdsiz mablag'.

Tizim inkassatsiya qilish mumkin bo'lgan summani avtomatik hisoblaydi
(smenadagi barcha naqd fiskal sotuvlar asosida).

**Aniq ERP holati:** ✅ qurildi (2026-10-14). `cashboxes.kind` ustuni
(`register`/`safe`/`bank`, standart — `register`) qo'shildi, `finance/cash`
sahifasida kassa yaratish/tahrirlashda tanlanadi, jadvalda turi-belgisi
ko'rsatiladi. Mavjud `/finance/transfer` (allaqachon bor edi) orqali
istalgan ikki kassa orasida (jumladan Seyf → Bank) qo'lda o'tkazish
qilinadi — bu PosPoint'ning alohida "Inkassatsiya" tugmasiga funksional
teng. Production'da API orqali sinaldi (Seyf kassasi yaratildi, balans
to'g'ri yangilandi).

### Smena yopilishi va inkassatsiya operatsiyasi

Smena yopilganda: inkassatsiya summasi ko'rsatiladi (avtomatik bank
hisobiga o'tadi) + qolgan naqd qoldiq ko'rsatiladi (kassadan
yechiladi, seyfga kirim qilinadi). Smenadan tashqari ham alohida
"Inkassatsiya" tugmasi bilan qilish mumkin (Seyf → Bank).

**Aniq ERP holati:** ✅ qurildi (2026-10-14). `POST /cashbox-sessions/{sid}/close`
endi smenadagi naqd-fiskal (payment_type.is_cash=TRUE) kirimlar
summasini hisoblab, org'da aktiv `kind='safe'` kassa bo'lsa, shu
smenani yopayotgan kassadan avtomatik o'sha summani Seyfga o'tkazadi
(javobda `inkassatsiya: {amount, to_cashbox_id}`, Seyf yo'q bo'lsa —
`null`, eski xatti-harakat saqlanadi). Mobil kassir ekranida
(`app/m/cashbox/page.tsx`) "Oxirgi yopilgan smena" blokida ko'rsatiladi.

**Shu yerda aniqlangan va tuzatilgan haqiqiy bug (2026-10-14):**
`cash_movements.cashbox_session_id` ustuni mavjud edi, lekin uni
to'ldiradigan hech qanday chaqiruvchi yo'q edi — na POS to'lov
(`sale/router.py::pay_sale`/`pay_sale_split`), na umumiy "Kassa
harakati" (`finance/router.py::create_movement`). Natijada
`_compute_session_totals()` (va shu orqali X/Z-hisobot, smena
kirim/chiqim summasi) **har doim 0 qaytarar edi** — bu avto-inkassatsiya
ishi boshlanganda tasodifan topildi. Tuzatildi: yangi
`finance/service.py::get_active_session_id()` yordamchisi uchala
yozuv nuqtasida ham joriy ochiq smenani topib, `cashbox_session_id`ni
to'g'ri belgilaydi. Production'da sinaldi: kirim yozuvi → smena
yopilganda to'g'ri summa bilan ko'rindi.

### Kassa daromadlari va xarajatlari

Sotish bilan bog'liq bo'lmagan kirim/chiqim (masalan: xo'jalik
xarajati, ijarachi to'lovi, hamkordan tushum) — summa, hisob, toifa,
izoh bilan.

**Aniq ERP holati:** ✅ bor — bu aynan REGOS parity ishida 2026-10-13da
POS ekraniga ulangan `POST /finance/movements` endpointi
(`direction: in|out|transfer`) — "Kassa harakati" tugmasi orqali.
Batafsil: [`docs/regos-pos/operations/additional-functions.md`](../../regos-pos/operations/additional-functions.md#kassa--внесениеизъятие-naqd-kiritishchiqarish).
Toifa (category) tanlash PosPoint'dagi kabi aniq tasdiqlanmadi — tekshirish kerak.

### Tranzaksiya jurnali

Barcha moliyaviy operatsiyalar: inkassatsiya, smena yopish, daromad/xarajat
— sana, tur, summa, hisoblar bilan, filtrlanadigan.

**Aniq ERP holati:** ✅ bor — `cash_movements` jadvali + `finance/balances`,
`finance/cashbox-sessions` sahifalari orqali ko'rinadi. Filtrlash
imkoniyati mavjud sahifalarda bor.

## Keyingi qadam

Asosiy gap bajarildi. Qolgan, past ustuvorlikdagi narsa: "Kassa
daromadlari va xarajatlari"da toifa (category) tanlashni aniq
tasdiqlash/qo'shish (PosPoint'da bor, Aniq ERP'da tekshirilmagan).
