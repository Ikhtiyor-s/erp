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

**Aniq ERP holati:** ⚠️ qisman. Aniq ERP'da `cashboxes` (kassalar) va
bank-hisoblar umumiy "hisob" (account) tushunchasi sifatida bor
(`finance/balances`, `finance/cash`, `finance/currency` sahifalari),
`cash_movements`/`cash_transfer` orqali ular orasida pul ko'chirilishi
mumkin. ❌ Lekin PosPoint'dagi kabi **nomlangan "Seyf" pog'onasi** va
**inkassatsiya summasini avtomatik hisoblash** (smenadagi naqd-fiskal
sotuv asosida) aniq shaklda yo'q — bu umumiy arxitektura ustiga
qurilishi mumkin bo'lgan, lekin hali qurilmagan konkret ish oqimi.

### Smena yopilishi va inkassatsiya operatsiyasi

Smena yopilganda: inkassatsiya summasi ko'rsatiladi (avtomatik bank
hisobiga o'tadi) + qolgan naqd qoldiq ko'rsatiladi (kassadan
yechiladi, seyfga kirim qilinadi). Smenadan tashqari ham alohida
"Inkassatsiya" tugmasi bilan qilish mumkin (Seyf → Bank).

**Aniq ERP holati:** ⚠️ qisman. Smena yopish endpointi bor
(`POST /cashbox-sessions/{sid}/close`, `apps/api/app/modules/mobile/router.py`),
lekin bu PosPoint'dagi **inkassatsiya-avtomatik-hisoblash +
Seyf-pog'onasiga o'tkazish** qadamini o'z ichiga olmaydi — smena yopish
va pul-ko'chirish Aniq ERP'da bog'liq emas, alohida amallar.

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

Eng aniq, amaliy gap — **smena yopilishini inkassatsiya bilan
bog'lash**: hozir Aniq ERP'da bular ikkita mustaqil amal, PosPoint'da
esa smena yopilishi bitta ekranda naqd-qoldiqni hisoblab, seyfga
o'tkazadi. Bu o'rta kattalikdagi ish — mavjud `cash_movements`/
`cashbox-sessions` arxitekturasini kengaytirish, yangi tizim yaratish
emas. "Seyf" alohida hisob-turi sifatida qo'shilishi kerak bo'ladi
(yoki mavjud hisob-turlaridan biriga rol sifatida belgilanishi mumkin).
