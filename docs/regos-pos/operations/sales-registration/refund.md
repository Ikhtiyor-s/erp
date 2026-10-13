# Qaytarish rejimi

Manba: `docs.regos.uz/ru/regos-pos/operations/sales-registration/refund`

## REGOS mexanikasi

`F5` orqali yoqiladi — **xuddi shu kassir ekranida**, alohida sahifaga
o'tmasdan. Yoqilgandan keyin tizim ikkitadan birini kutadi:

- asl mahsulotning shtrix-kodini skanerlash, YOKI
- asl sotuv hujjatini raqami bo'yicha qidirish.

Qaytarish cheki fiskal ma'lumot talab qilmaydi (soddaroq hujjat).

REGOS:VCR ulangan bo'lsa, QR-fiskal-chek skaneri UI'si chiqadi (yoki
qo'lda: ПОФМ chek raqami, Terminal ID, sana, 12-xonali fiskal imzo) — bu
O'zbekistonga xos fiskal modul (ККМ/ФМ) integratsiyasi, Aniq ERP hali real
fiskal printer bilan integratsiyalashmagani uchun hozircha tegishli emas.

## Aniq ERP holati

⚠️ **Qisman — qobiliyat bor, lekin joylashuvi boshqacha.**

Backend (`sale_returns` jadvali + endpointlari, `apps/api/app/modules/sale/router.py`)
va frontend (`apps/web/app/(dashboard)/sale/return/page.tsx`, 712 qator) —
ikkalasi ham mavjud va `doc_number` bo'yicha qidiruvni qo'llab-quvvatlaydi.
**Qobiliyatning o'zi yo'q emas.**

Farq — UX joylashuvi: REGOS'da qaytarish **kassir ekranining o'zida**
F5-toggle sifatida ishlaydi (kassir hech qayerga ketmaydi). Aniq ERP'da bu
**alohida orqa-ofis sahifasi** — kassir savdo ekranidan chiqib, boshqa
sahifaga o'tishi kerak.

2026-10-13 sessiyasida `pos/page.tsx`ga **F5 hotkey** va **"Qaytarish"**
tugmasi qo'shildi — lekin bular hozircha faqat `/sale/return` sahifasiga
**navigatsiya qiladi** (`router.push`), REGOS'dagidek shu ekranning ichida
rejim almashtirmaydi.

## Keyingi qadam

Haqiqiy "F5 = shu ekranda qaytarish rejimi" qilish katta ish: POS
ekraniga rejim-holati (sotuv/qaytarish), barcode-yoki-chek-raqami bo'yicha
qidiruv UI'si, va mavjud `sale_returns` backend logikasini shu rejimga
ulash kerak. Hozircha ticketlanmagan — agar kassir tezligi muhim bo'lsa
(qaytarish uchun alohida sahifaga o'tish sekinlashtiradi), bu nomzod
ticket.

Fiskal (ККМ/ФМ) integratsiya — Aniq ERP'da fiskal printer integratsiyasi
umuman yo'qligi sababli, bu REGOS qismi hozircha dolzarb emas.
