# Multivalyuta

Manba: `pospoint.uz/uz/knowledge-base/multicurrency`

## PosPoint nima qiladi

Ikki valyutada ishlash: so'm (asosiy) + AQSH dollari (qo'shimcha).

- **Sozlamalar:** Multivalyuta rejimi yoqiladi, foydalanuvchi qo'lda
  joriy kursni kiritadi; operatsiya turi tanlanadi (faqat Sotish, faqat
  Xarid, yoki ikkalasi — shu turlarga qarab funksiya qaysi bo'limlarda
  ishlashi belgilanadi).
- **Kassa oynasi:** yoqilgandan so'ng oyna yuqorisida kurs ko'rsatiladi;
  mahsulotlar ro'yxatida har bir pozitsiya **ikki narxda** (so'm va
  USD) ko'rsatiladi, kiritilgan valyutadan qat'i nazar.
- **Pozitsiya qo'shish / xarid:** mahsulot yaratishda narx+valyuta
  ko'rsatiladi; xuddi shu tartib xarid hujjatida ham ishlaydi.
- **To'lov:** mijoz to'lovni so'mda yoki dollarda, yoki **aralash**
  (bir qismi so'mda, bir qismi dollarda) amalga oshirishi mumkin —
  tizim hisob-kitobni avtomatik qiladi.
- **Analitika:** barcha hisobotlar ikki valyutada ko'rsatiladi
  (SO'M↔USD almashtirgich).

## Aniq ERP holati

⚠️ **Ataylab cheklangan: faqat ko'rsatish (2026-10-14, foydalanuvchi
tanlovi).** To'liq PosPoint-parity (narx-modelini ikki-valyutali qilish,
aralash-to'lov hisob-kitobi) yuqori xato-xavfiga ega (pul hisob-kitobi)
deb baholandi — foydalanuvchi "faqat ko'rsatish (soddaroq, xavfsizroq)"
variantini tanladi.

Qurilgani:
- `/settings/multicurrency` — org darajasida yoqish/o'chirish +
  qo'shimcha valyuta kodi (masalan "USD"). Backend o'zgarishi kerak
  emas edi — mavjud umumiy `/settings/key/*` va allaqachon to'liq
  qurilgan `/reference/currencies/rates/latest` (CBU import bilan
  birga) orqali ishlaydi.
- POS'da (`pos/page.tsx`): yoqilgan bo'lsa, sarlavha satrida joriy kurs
  ("1 USD = 12 650 so'm"), TO'LOVGA summasi, savatdagi har bir qator va
  oxirgi qo'shilgan mahsulot tagida qo'shimcha valyutadagi taxminiy
  ekvivalent (`≈ $X.XX`) ko'rsatiladi. Agar tanlangan valyutaning kursi
  hali kiritilmagan bo'lsa — hech narsa ko'rsatilmaydi (xato emas,
  shunchaki yashirin).

❌ Hali yo'q (ataylab, foydalanuvchi tanloviga ko'ra): aralash to'lov
(bir qismi so'mda, bir qismi USD'da bitta chekda), mahsulot-darajasida
ikkinchi narx, operatsiya-turi bo'yicha qamrov sozlamasi, hisobotlarda
ikki-valyutali ko'rsatish. To'lov va hisob-kitob hamon to'liq bitta
(baza) valyutada — bu borada xatti-harakat o'zgarmadi.

Production'da API orqali sinaldi: sozlama o'qish/yozish ishlaydi;
`/reference/currencies/rates/latest` to'g'ri javob beradi (hozircha
production'da hech qaysi valyuta uchun kurs kiritilmagan — bu kurslar
faqat superadmin tomonidan kiritiladi/CBU'dan import qilinadi, POS
kodi buni to'g'ri "kurs yo'q" holati sifatida aniqlab, ko'rsatmay
qoladi — xato bermaydi).

## Keyingi qadam

Agar kelajakda to'liq aralash-to'lov va ikki-valyutali narx-model
kerak bo'lsa — bu alohida, kattaroq qaror bo'lib qoladi (narx-modelini
qayta qurish, to'lov hisob-kitobini qattiq test qilish talab etiladi).
Hozirgi "faqat ko'rsatish" qatlami shu kattaroq ishga to'sqinlik
qilmaydi — ustiga qurilishi mumkin.
