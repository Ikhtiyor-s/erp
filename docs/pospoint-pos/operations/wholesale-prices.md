# Ulgurji narxlar

Manba: `pospoint.uz/uz/knowledge-base/wholesale`

## PosPoint nima qiladi

Oddiy narxdan tashqari **ulgurji (optom) narx** bilan ishlash rejimi.

- Sozlamalar → Umumiy sozlamalar → Ulgurji narxlar bo'limida svitch
  yoqiladi — shundan so'ng POS oynasi yuqorisida "Ulgurji narx" belgisi
  paydo bo'ladi (standart holati — o'chiq).
- Mahsulot qo'shishda (katalogda) ikkinchi — ulgurji — narx ham
  belgilanadi; mahsulot shu bilan ikki xil narxda sotishga tayyor
  bo'ladi.
- POS'da rejim belgisi: qizil = oddiy narx faol, yashil = ulgurji narx
  faol — kassir bitta bosish bilan almashtiradi.
- Savatda umumiy summa va **mijoz bu savdodan qancha "foyda" qilayotgani**
  (ya'ni oddiy narxga nisbatan tejagan summasi) ko'rsatiladi.

## Aniq ERP holati

✅ **Qurildi (2026-10-14).** `products.wholesale_price` (NUMERIC, NULL
bo'lishi mumkin) qo'shildi. Mahsulot formasida ("Ulgurji narx" maydoni,
`warehouse/products/page.tsx`) kiritiladi. Sozlamalar → Sozlamalar →
"Ulgurji narxlar" (`/settings/wholesale-prices`, `app_settings` kaliti
`wholesale_prices`, `{enabled: bool}`) orqali butun tashkilot bo'yicha
yoqiladi/o'chiriladi (standart — o'chiq). POS hujjat sarlavhasida
("YANGI SOTUV (CHAKANA NARX)" o'rnida) qizil/yashil almashtirgich tugma
— faqat sozlama yoqilgan bo'lsa ko'rinadi, bosilganda butun savat
narxini ulgurji narxga o'tkazadi (mahsulotda ulgurji narx bo'lmasa —
chakana narxga tushadi), tepada "Tejov" summasi ko'rsatiladi. Har yangi
sotuvdan keyin (yoki bekor qilinganda) rejim avtomatik chakanaga
qaytadi. Production'da API orqali sinaldi (mahsulot yaratish/yangilash/
tozalash, sozlama yozish/o'qish) — brauzer orqali to'liq UI oqimi
sinab ko'rilmadi (login holati sabab), lekin typecheck toza o'tdi.

Eslatma: Aniq ERP'da mijoz-darajasidagi maxsus narxlar uchun
`customer/router.py`da `CustomerPriceIn` (mijozga xos narx) ham bor —
bu ikkinchi, mustaqil mexanizm, ulgurji-rejim bilan birga ishlashi
mumkin (bir-birini istisno qilmaydi), lekin POS hozircha ikkisini bir
vaqtda qo'llash tartibini aniq belgilamagan (agar ikkalasi ham faol
bo'lsa, qaysi narx ustunligi — keyingi qadam, hozircha kam uchraydigan
holat).

## Keyingi qadam

Asosiy funksionallik tayyor. Qolgan: (1) ikkala narx mexanizmi (ulgurji
rejim + mijozga xos narx) bir vaqtda faol bo'lganda qaysi narx
ustunligini aniq belgilash; (2) brauzer orqali to'liq UI-oqimni real
foydalanuvchi bilan sinash.
