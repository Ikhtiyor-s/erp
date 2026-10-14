# PosPoint parity — hujjatlar

> Manba: `pospoint.uz/uz` bosh sahifasi + `pospoint.uz/uz/knowledge-base`
> (2026-10-13 da to'liq o'qib chiqildi).
> Maqsad: PosPoint'ning (yana bir O'zbekiston chakana-POS raqobatchisi,
> REGOS bilan bir toifada) kassir-ekrani va umumiy tizim imkoniyatlarini
> hujjatlashtirish, har bir bo'lim uchun **Aniq ERP hozir nima qiladi**
> (bor / yo'q / qisman) deb belgilash.

Bu papka [`docs/regos-pos/`](../regos-pos/README.md) ishining davomi —
**REGOS o'rnini bosmaydi**, balki unga **qo'shimcha ikkinchi havola**
sifatida ishlaydi. REGOS hujjatlari kassir-ekranining aniq workflow'iga
(holat-modeli, sторno, hotkeylar) chuqur boradi; PosPoint hujjatlari esa
REGOS qamrab olmagan bir nechta **yangi, konkret funksiyalarni**
(masalan multivalyuta, ulgurji narx rejimi, 3-pog'onali kassa/seyf/bank
balansi) ochib beradi.

## Qanday o'qiladi

Har bir fayl REGOS hujjatlari bilan bir xil uslubda:

1. **PosPoint nima qiladi** — `pospoint.uz`dan olingan, qadam-baqadam
   mexanika (PosPoint'ning o'z Bilimlar bazasidan, 2026-10-13).
2. **Aniq ERP holati** — kodga qarab tekshirilgan (`apps/web/app/(dashboard)/pos/page.tsx`,
   `apps/api/app/modules/*`) haqiqiy holat: ✅ bor / ⚠️ qisman / ❌ yo'q.
3. **Keyingi qadam** — agar gap bo'lsa, qisqa izoh (bu hujjat ham REGOS
   hujjatlari kabi — ticket emas, faqat xarita).

## PosPoint bosh sahifasi — tashkiliy eslatma

PosPoint bitta kompaniyaning ikkita alohida mahsuloti bor: **chakana
do'kon uchun** (`pospoint.uz`, shu hujjatlar qamrovi) va **kafe/restoran
uchun** (`resto.pospoint.uz`, alohida mahsulot — bu yerda o'rganilmadi,
chunki Aniq ERP'ning restoran-yo'nalishi yo'q, restoran faqat Biznes POS
loyihasida bor va u Aniq ERP bilan birlashtirilmaydi).

## Bo'limlar

- [`operations/cash-register.md`](operations/cash-register.md) — Kassa (sotuv, to'lov, qaytarish, chegirma, qarzga sotish, kechiktirish)
- [`operations/product-catalog.md`](operations/product-catalog.md) — Tovarlar katalogi (bo'limlar, tezkor kiritish, ommaviy yuklash)
- [`operations/customers.md`](operations/customers.md) — Mijozlar (qarz limiti, tranzaksiya tarixi, tug'ilgan kun filtri)
- [`operations/warehouse.md`](operations/warehouse.md) — Ombor (qoldiq, xarid, ko'chirish, hisobdan chiqarish, inventarizatsiya)
- [`operations/finance.md`](operations/finance.md) — Moliya (kassa/seyf/bank 3-pog'onali balans, inkassatsiya, daromad/xarajat)
- [`operations/settings.md`](operations/settings.md) — Sozlamalar (fiskal rejim, manfiy qoldiq siyosati, katalog ko'rinishi, PIN-kirish)
- [`operations/multicurrency.md`](operations/multicurrency.md) — Multivalyuta (so'm + USD, aralash to'lov)
- [`operations/wholesale-prices.md`](operations/wholesale-prices.md) — Ulgurji narxlar (ikki narxli rejim)

## Umumiy holat (2026-10-13)

| Bo'lim | Holat |
|---|---|
| Kassa — asosiy sotuv/to'lov/qaytarish/chegirma | ✅ REGOS parity ishi orqali allaqachon qamrab olingan (`docs/regos-pos/`) |
| Kassa — qarzga sotish (to'g'ridan-to'g'ri to'lov oynasidan) | ⚠️ Mijozlar tizimida qarz-balans bor, lekin POS to'lov oynasida "Qarzga" alohida to'lov-usuli sifatida yo'q |
| Kassa — chekni kechiktirish | ✅ qurildi (REGOS parity, "Kutish rejimi" nomi bilan) |
| Tovarlar katalogi — bo'limlar, qo'shish, tahrirlash | ✅ bor (`warehouse/products`, `warehouse/category`) |
| Tovarlar katalogi — Excel orqali ommaviy yuklash | ✅ bor (import funksiyasi mavjud) |
| Tovarlar katalogi — Tasnif bazasidan avtomatik to'ldirish | ❌ yo'q — O'zbekiston MXIK/Tasnif integratsiyasi yo'q |
| Mijozlar — qarz limiti + POS enforcement | ✅ qurildi 2026-10-14, production'da API orqali sinaldi |
| Mijozlar — tug'ilgan kun maydoni/filtri | ⚠️ qisman — maydon bor, filtr va avtomatik SMS job yo'q |
| Ombor — qoldiq/xarid/ko'chirish/hisobdan chiqarish/inventarizatsiya | ✅ deyarli to'liq — Aniq ERP'ning ombor moduli PosPoint'dan ancha boy (Odoo-vision asosida qurilgan) |
| Moliya — kassa/seyf/bank 3-pog'onali balans + inkassatsiya | ✅ qurildi 2026-10-14, production'da sinaldi (yo'lda `cashbox_session_id` hech qachon to'ldirilmagan haqiqiy bug ham topildi va tuzatildi) |
| Sozlamalar — fiskal rejim (onlayn-kassa) | ❌ yo'q — hech qanday fiskal registrator/modul integratsiyasi yo'q |
| Sozlamalar — manfiy qoldiq siyosati (3 variant) | ✅ qurildi 2026-10-14, API orqali sinaldi |
| Sozlamalar — katalog ko'rinish rejimi (dorixona/yengillashtirilgan) | ❌ yo'q |
| Sozlamalar — PIN bilan tezkor kirish | ✅ qurildi 2026-10-14 (set-pin/pin-login, 2FA bilan mos kelmaydi — ataylab) |
| Multivalyuta (so'm+USD) | ⚠️ ataylab faqat-ko'rsatish darajasida qurildi 2026-10-14 (foydalanuvchi tanlovi) — aralash to'lov yo'q |
| Ulgurji narxlar (ikki narxli rejim) | ✅ qurildi 2026-10-14, API orqali sinaldi |
| Mahsulot variantlari (o'lcham/rang) | ✅ generik shaklda bor (`products.is_variant` + `parent_id`), lekin PosPoint'dagi kabi aniq "attribut" (o'lcham, rang) tizimi emas — erkin parent-child bog'lanish |
| EDO (Didox) integratsiyasi | ✅ bor (`apps/api/app/modules/integration/didox.py`) — bu yerda Aniq ERP PosPoint'dan **oldinda emas, barobar** |
| Tavsiya etilgan xaridlar (restock AI) | ✅ bor (`warehouse/recommended-stock`) — Aniq ERP'da ham mavjud |
| Rahbar uchun mobil ilova (real-vaqt savdo/qoldiq/moliya) | — tekshirilmadi (bu alohida mobil-ilova loyihasi bo'lardi, joriy tadqiqot qamroviga kirmaydi) |

## REGOS bilan solishtirganda — nima yangi, nima takror

**PosPoint'da bor, REGOS hujjatlarida aytilmagan (haqiqiy yangi gap'lar):**
- Multivalyuta (so'm + USD ikki narxli, aralash to'lov) — butunlay yangi funksiya klassi, REGOS parity ishida umuman ko'rilmagan.
- Ulgurji narxlar (optom-rejim, ikki narxli chek) — xuddi shunday, yangi.
- Kassa/Seyf/Bank 3-pog'onali balans + smenaga bog'langan avtomatik inkassatsiya — REGOS'da ham "Внесение/Изъятие" bor edi (bu allaqachon ✅ qurilgan), lekin PosPoint'ning **seyf** tushunchasi va **inkassatsiya summasini avtomatik hisoblash** REGOS hujjatlarida yo'q edi.
- Katalog ko'rinish rejimlari (dorixona/yengillashtirilgan) va manfiy qoldiq siyosatining 3 varianti — sozlamalar darajasidagi aniqlik, REGOS buni bunchalik batafsil hujjatlamagan.
- PIN bilan tezkor kirish — REGOS parity hujjatlarida yo'q edi.

**PosPoint va REGOS'da ikkalasida ham bor (demak Aniq ERP uchun ustuvorligi REGOS parity ishi orqali allaqachon rejalashtirilgan yoki qurilgan):**
- Chekni kechiktirish (PosPoint: "Chekni kechiktirish", REGOS: "Отложить") — ✅ Aniq ERP'da qurilgan.
- Chegirma (qator/butun chek) — ✅ Aniq ERP'da qisman qurilgan (butun-chek darajasida).
- Qarzga sotish — ikkalasida ham bor, Aniq ERP'da mijozlar tizimi orqali qisman bor.
- Markirovka kodi tekshirish — ikkalasida ham tilga olingan, Aniq ERP'da ❌ yo'q (REGOS hujjatida ham gap sifatida qayd etilgan).
- Tarozi bilan ishlash — ikkalasida ham bor, Aniq ERP'da ⚠️ qisman (REGOS hujjatida batafsil yozilgan: nol/tara yo'q).

## Holat (2026-10-14) — barcha 5 band yakunlandi

Yuqoridagi "Keyingi qadam" ro'yxati (2026-10-13) foydalanuvchining
"reja tuzib ketma ket bajar" ko'rsatmasi bo'yicha to'liq bajarildi,
har biri alohida commit+push, production'da API orqali sinaldi:

1. ✅ Mijoz qarz limiti + tug'ilgan kun.
2. ✅ Ulgurji narxlar (ikki narxli rejim, POS'da almashtirgich).
3. ✅ Sozlamalar: manfiy qoldiq siyosati (3 variant) + PIN tezkor kirish.
4. ✅ Moliya: Kassa/Seyf/Bank 3-pog'onali balans + smena-yopilishida
   avtomatik inkassatsiya (yo'lda `cashbox_session_id` hech qachon
   to'ldirilmagan haqiqiy bug ham topildi va tuzatildi).
5. ⚠️ Multivalyuta — foydalanuvchi ataylab **faqat-ko'rsatish**
   darajasini tanladi (to'liq aralash-to'lov emas, pul hisob-kitobi
   xato-xavfi yuqori deb baholandi). Qolgan chuqurroq daraja —
   [`operations/multicurrency.md`](operations/multicurrency.md)dagi
   "Keyingi qadam"da.
