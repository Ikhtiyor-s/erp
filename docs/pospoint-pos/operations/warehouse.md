# Ombor

Manba: `pospoint.uz/uz/knowledge-base/warehouse`

## PosPoint nima qiladi

Tovar qoldiqlarini boshqarish, xaridlar, omborlar o'rtasidagi harakat,
hisobdan chiqarish, inventarizatsiya.

### Qoldiqlar

Barcha tovarlar va joriy miqdori; faqat o'zining kassasiga biriktirilgan
ombor qoldig'i ko'rsatiladi.

**Aniq ERP holati:** ✅ bor — `warehouse/products` jadvalida qoldiq
ustuni, `product-warehouses` sahifasi omborlar kesimida ko'rsatadi.

### Xarid qilish

Yetkazib beruvchi, hujjat raqami/sanasi, tovar+miqdor+narx, (ixtiyoriy)
partiya/yaroqlilik muddati → rasmiylashtirilgach qoldiq ko'payadi.

**Aniq ERP holati:** ✅ bor — `warehouse/stock-in` (`StockInIn`/`StockInItemIn`,
router.py:3594). Partiya/yaroqlilik muddati hisobi — Aniq ERP'da
`has_expiration` mahsulot darajasida bor, lekin partiya-seriyasi (lot/batch)
alohida kuzatuvi chuqur tekshirilmadi.

### Tovarlarni ko'chirish

Qabul qiluvchi ombor, mahsulot+miqdor; jo'natuvchi ombordagi qoldiqdan
ko'p ko'chirib bo'lmaydi.

**Aniq ERP holati:** ✅ bor — `warehouse/internal-transfers`
(`InternalTransferIn`, router.py:1329), `allow_negative=False` orqali
yetarli-qoldiq tekshiruvi backend darajasida ta'minlanadi
(`warehouse/service.py`).

### Hisobdan chiqarish

Sabab ko'rsatilib (buzilgan, yo'qolgan, muddati tugagan), mahsulot+miqdor.

**Aniq ERP holati:** ✅ bor — `warehouse/write-off` +
`warehouse/write-off-reason` (`WriteOffIn`, router.py:1722) — sabab
alohida spravochnik sifatida ham bor, bu PosPoint'dan **kengroq**
(PosPoint'da sabab erkin matn, Aniq ERP'da strukturalangan sabab-katalog).

### Inventarizatsiya

Qidiruv orqali qo'lda yoki avtomatik (barcha qoldiqli tovar) kiritish,
haqiqiy miqdorni ko'rsatish (shtrix-kod skanerlash bilan), bo'sh
qoldirilgan pozitsiya qayta hisoblanmaydi, o'tkazilgach qoldiq avtomatik
to'g'irlanadi.

**Aniq ERP holati:** ✅ bor — `warehouse/revision` sahifasi.

### Operatsiyalar jurnali

Barcha xarid/ko'chirish/hisobdan chiqarish/inventarizatsiya yozuvlari;
sana va harakat turi bo'yicha filtr.

**Aniq ERP holati:** ✅ bor — har bir operatsiya `stock_movements`
jadvaliga yoziladi (`warehouse/service.py`dagi umumiy `adjust_stock()`
funksiyasi orqali), bu PosPoint'nikidan ham markazlashganroq arxitektura
(bitta umumiy harakat-jurnali, har bir modul uni qayta ishlatadi).

## Xulosa

Bu bo'limda Aniq ERP PosPoint bilan **deyarli to'liq barobar, ba'zi
joyda undan oldinda** — sabab Aniq ERP'ning "Odoo/MoySklad'dan kuchli
bo'lishi kerak" vizioni asosida ombor moduli allaqachon chuqur qurilgan
(`project_erp_odoo_vision.md`). Qo'shimcha PosPoint'dan o'rganiladigan
narsa deyarli yo'q bu bo'limda.

## Keyingi qadam

Ustuvor gap yo'q — bu bo'lim bo'yicha Aniq ERP allaqachon PosPoint
darajasida yoki undan yuqori. Faqat partiya/lot-seriyasi kuzatuvining
chuqurligi (dori/yaroqlilik-muddat sohasi uchun) alohida tekshirishga
arziydi, agar foydalanuvchi shunday mijozlarga xizmat qilsa.
