# Qo'shimcha funksiyalar

Manba: `docs.regos.uz/ru/regos-pos/operations/additional-functions`

## Chegirma / ustama (markup)

`%`-chegirma yoki summa-chegirma, ikkalasi ham **qator** darajasida yoki
**butun hujjat** darajasida qo'llanishi mumkin (jami 4 kombinatsiya) —
klaviaturadan kiritiladi, `Enter` bilan qo'llanadi.

**Aniq ERP holati:** ✅ **Qisman qurildi (2026-10-13).** `sale_items.discount`
ustuni bazada va backend'da (`apps/api/app/modules/sale/router.py`)
avvaldan bor edi, lekin POS ekranida uni qo'yish uchun UI yo'q edi.
2026-10-13da **butun-hujjat darajasidagi** chegirma (% yoki so'm) qo'shildi
— `pos/page.tsx`dagi "Chegirma" tugmasi, keyin har bir qatorga proporsional
taqsimlanadi (`ensureSale()` ichida). ❌ **Qator darajasidagi** chegirma
(bitta mahsulotga alohida) hali yo'q.

## Продавец (sotuvchi kodi)

6 xonali kod (`10100X` prefiks + xodim kodi) — komissiya hisobidan
kuzatish uchun sotuvga biriktiriladi.

**Aniq ERP holati:** ❌ Yo'q. `schema_patches.py` yoki `sale/*` modulida
`seller_id` yoki unga o'xshash ustun topilmadi. Hozircha hech qanday
ticket ham yo'q. (`created_by` — sotuvni kim YARATGANI, bu boshqa narsa;
REGOS'dagi "Продавец" boshqa birov ro'yxatga kiritgan sotuvni boshqa
xodimga biriktirish imkonini beradi, komissiya maqsadida.)

## Kassa → Внесение/Изъятие (naqd kiritish/chiqarish)

Har qanday sotuvdan mustaqil ravishda — kassaga naqd qo'shish (masalan
smena boshida float) yoki olib qo'yish (masalan menejer pulni olib
ketganda). **Открыть ден. ящик** (qutini ochish) ham shu yerda, lekin bu
sotuv vaqtidagi harakat bilan bir xil.

**Aniq ERP holati:** ✅ **To'liq (2026-10-13da POS ekraniga ulandi).**
Birinchi tekshiruvda (2026-10-12/13 tadqiqot) bu backend'da "umuman yo'q"
deb xato xulosa chiqarilgan edi — sabab, `cash_in`/`cash_out` so'zlari
bo'yicha qidiruv natija bermagan. Aslida qobiliyat **avvaldan, umumiy
`POST /finance/movements` endpoint sifatida mavjud edi** (`direction: "in"
| "out" | "transfer"`, `cash_movements`ga yozadi, `cashboxes.balance`ni
yangilaydi, buxgalteriya provodkasini yaratadi) — shunchaki REGOS'ning
"Внесение/Изъятие" nomi bilan emas, umumiyroq nom bilan qurilgan edi. Bu
real gap emas, **qidiruv/tadqiqot xatosi** bo'lgan — endi tuzatilgan.

2026-10-13da qilingan yagona haqiqiy ish: POS ekranining "Kassa harakati"
tugmasini (avval stub) ushbu mavjud endpointga ulash — kichik modal
(Kiritish/Chiqarish, summa, sabab), kassir hech qayerga chiqmasdan
foydalanadi. Jonli production'da sinaldi (kassa balansi to'g'ri
yangilanishi tasdiqlandi).

Qutini ochish — ✅ bor (`openCashDrawer()`, POS-3, 2026-10-12).

## Карта покупателя (mijoz kartasi)

Shtrix-kod bo'yicha mijoz kartasi + **Создание карты покупателя** (joyida
ro'yxatdan o'tkazish — telefon raqami bo'yicha serverdan qidirish, agar
jismoniy karta bo'lmasa telefon raqamidan EAN13 shtrix-kod avtomatik
generatsiya qilinadi).

**Aniq ERP holati:** ⚠️ Mijozlar tizimida bor (bloklovchi gap emas), lekin
REGOS'dagi "shtrix-kod-karta" UX'i yo'q — hozir oddiy `<select>`
dropdown orqali tanlanadi (`pos/page.tsx`). Joyida yangi mijoz
ro'yxatga olish POS ekranining o'zida yo'q.

## Заказ / Возврат заказа (buyurtma navbati)

Holat "Утверждён" (tasdiqlangan) bo'lgan chakana buyurtmalar navbati —
kassir uni ochib, sotuvga aylantirishi mumkin (sozlamaga qarab savat
avtomatik to'ldiriladi).

**Aniq ERP holati:** ⚠️ Konseptual ekvivalenti bor, lekin boshqa
yo'nalishda. EC (ecommerce B2B/B2C, 2026-10-12 sprint) buyurtma→sotuv
o'tkazmasi (`create_sale_core`) serverда avtomatik ishlaydi — lekin bu
**kassir tomonidan "navbatni ochib sotuvga aylantirish"** emas, balki
mijozning o'zi portal/do'kondan buyurtma berganda avtomatik yuz beradi.
Kassirga mo'ljallangan "kutayotgan buyurtmalarni ko'rib, birini tanlab
savatga yuklash" ekrani POS'da yo'q.

## Весы (tarozi)

Og'irlikni olish / nolga tushirish / tara (idish og'irligini chiqarib
tashlash) — har biri alohida hotkey+menyu.

**Aniq ERP holati:** ⚠️ Qisman. `connectScale()`/`readScale()`
(`apps/web/lib/bt-printer.ts`) uzluksiz og'irlik oqimini beradi — lekin
**nol** yoki **tara** tushunchasi umuman yo'q. Haqiqiy do'konda idishli/
quyma tovar (masalan konteynerdagi mahsulot) sotilsa, bu haqiqiy gap.

## Баланс карты (to'lov-terminal balans tekshiruvi)

**Aniq ERP holati:** — tegishli emas, hech qanday to'lov-terminal
integratsiyasi yo'q.

## Keyingi qadam (ustuvorlik tartibida, REGOS parity doirasida)

1. ✅ ~~Chegirma (butun hujjat)~~ — qilindi, 2026-10-13
2. ✅ ~~Kassaga naqd kiritish/chiqarish~~ — backend avvaldan bor edi, POS
   ekraniga ulandi, 2026-10-13
3. Qator darajasidagi chegirma — kichikroq qo'shimcha, mavjud chegirma
   UI'sini kengaytirish
4. Sotuvchi kodi — yangi ustun + UI, komissiya hisobotlari uchun kerak
   bo'lsagina ustuvor
5. Tarozi nol/tara — faqat idishli/quyma tovar sotiladigan mijozlar uchun
   dolzarb
