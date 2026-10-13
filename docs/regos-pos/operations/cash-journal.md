# Kassa jurnali

Manba: `docs.regos.uz/ru/regos-pos/operations/cash-journal`

## REGOS mexanikasi

Oddiy: joriy kassaning **barcha** naqd harakatlarini (barcha smenalar
bo'ylab) ro'yxatlaydi, sana-oralig'i bo'yicha filtrlanadi.

## Aniq ERP holati

✅ **Bor** — `apps/web/app/(dashboard)/finance/cash/page.tsx` +
`apps/api/app/modules/finance/router.py`dagi `cash_movements` jadvali
asosidagi endpointlar. Ushbu hujjatlar to'plami tayyorlangan paytda bu
sahifa REGOS'ning aniq maydon tartibi bilan solishtirib chiqilmadi (faqat
mavjudligi tasdiqlandi), lekin asosiy qobiliyat (naqd harakatlar +
filtrlash) mavjud ko'rinadi.

## Keyingi qadam

Past ustuvorlik — agar kelajakda kassa jurnali REGOS bilan to'liq
solishtirilishi kerak bo'lsa, `finance/cash/page.tsx`ning aniq ustunlari
(sana, summa, yo'nalish, sabab, kim amalga oshirgan, smena) yuqoridagi
mexanika bilan qayta tekshirilishi kerak — hozircha gap deb belgilanmagan,
chunki asosiy qobiliyat mavjud.
