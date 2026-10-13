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

⚠️ **Faqat ma'lumot darajasida bor, operatsion darajada yo'q.**

- `products.currency_id` ustuni bor — mahsulotga bitta valyuta
  biriktirish mumkin (`warehouse/products/page.tsx`dagi "Valyuta"
  maydoni).
- `finance/currency` sahifasi bor — valyuta kurslarini boshqarish
  uchun spravochnik.
- ❌ POS ekranida (`pos/page.tsx`) narxni **ikki valyutada bir vaqtda**
  ko'rsatish yo'q — har bir mahsulot faqat o'zining `currency_id`si
  bilan bog'langan bitta narxda ko'rinadi.
- ❌ To'lov oynasida **aralash to'lov (ikki valyutada bir chekka)**
  imkoniyati yo'q — `pos/page.tsx`dagi to'lov-turlari ro'yxati bitta
  umumiy summa va bitta tanlangan to'lov-usuli bilan ishlaydi.
- ❌ Operatsiya-turi bo'yicha (faqat sotish / faqat xarid / ikkalasi)
  multivalyuta qamrovini sozlash imkoniyati yo'q — bunday rejim
  tushunchasi umuman yo'q.
- ❌ Analitika/hisobotlarda ikki-valyutali ko'rsatish (SO'M↔USD
  switch) topilmadi.

## Keyingi qadam

Bu **butunlay yangi funksiya klassi** — na REGOS, na hozirgi Aniq ERP
arxitekturasida bunday chuqurlikda yo'q. Agar foydalanuvchining
mijozlarida chet-el valyutasida (odatda USD) savdo haqiqatan kerak
bo'lsa (masalan qurilish materiallari sohasida, PosPoint buni "Qurilish
do'koni" uchun tavsiya qiladi), bu alohida arxitektura qarori va
ko'proq ishni talab qiladi: narx-modelini ikki-valyutali qilish, POS
UI'da parallel narx ko'rsatish, aralash-to'lov hisob-kitobi, hisobotlarni
ikki valyutada chiqarish. Past-o'rtacha ustuvorlik — faqat aniq
biznes-ehtiyoj tasdiqlansa boshlanishi kerak.
