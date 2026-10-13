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

❌ **Yo'q.** Kodda "wholesale"/"ulgurji"/"optom" so'zlari bo'yicha
qidiruv (`apps/api/app/modules/`) hech narsa topmadi. `products`
jadvalida faqat bitta `sale_price` ustuni bor — ikkinchi (ulgurji) narx
uchun joy yo'q. POS ekranida rejim-almashtirgich tushunchasi ham yo'q.

Eslatma: Aniq ERP'da mijoz-darajasidagi maxsus narxlar uchun
`customer/router.py`da `CustomerPriceIn` (mijozga xos narx) bor —
bu **konseptual jihatdan yaqin**, lekin PosPoint'ning "butun kassa
rejimini ulgurji-narxga almashtirish" mexanizmidan farq qiladi: u
mijozga bog'lanmagan, umumiy "optom rejim" tugmasi, har qanday
xaridorga qo'llanishi mumkin (do'konda ulgurji xaridor kelganda, tizimga
alohida mijoz sifatida kiritmasdan ham).

## Keyingi qadam

Agar foydalanuvchining do'konlarida chakana+ulgurji aralash savdo bo'lsa
(PosPoint buni ayniqsa "Qurilish do'koni" profili uchun tavsiya qiladi),
bu nisbatan kichik-o'rtacha ish bo'ladi: `products`ga ikkinchi narx
ustuni + POS'da rejim-svitch + savatda tejov-summasi ko'rsatish. Mavjud
`CustomerPriceIn` (mijozga xos narx) mexanizmi bilan birga ishlatilishi
ham mumkin — ikkisi bir-birini istisno qilmaydi.
