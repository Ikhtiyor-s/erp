# Sozlamalar

Manba: `pospoint.uz/uz/knowledge-base/settings`

## PosPoint nima qiladi

Kassa/tizim ishini biznes ehtiyojiga moslashtirish: kassa rejimi,
hisobga olish siyosati, katalog ko'rinishi, chek, til, xavfsizlik.

### Kassa rejimi (fiskal / nofiskal)

Kassani fiskal yoki fiskal bo'lmagan rejimga o'tkazish.

**Aniq ERP holati:** ❌ Yo'q — fiskal/onlayn-kassa tushunchasi umuman
yo'q (batafsil: [`cash-register.md`](cash-register.md#onlayn-kassa-fiskal-rejim)).

### Paket

Paket uchun narx belgilash — sotuvda bitta tezkor tugma bilan chekka
qo'shiladi.

**Aniq ERP holati:** ❌ Yo'q — bunday maxsus "paket to'lovi" tezkor
tugmasi ko'rilmadi. (Eslatma: bu kichik, lekin PosPoint'da alohida
marketing-xususiyat sifatida ajratilgan — O'zbekistonda do'konlarda
paket puli odatiy amaliyot.)

### Ombor — manfiy qoldiqli tovar siyosati (3 variant)

1. Sotishga ruxsat berish.
2. Ko'rsatish, lekin chekka qo'shishga ruxsat bermaslik.
3. Manfiy qoldiqli mahsulotlarni umuman ko'rsatmaslik.

**Aniq ERP holati:** ✅ qurildi (2026-10-14). `Склад (настройки)`
(`/settings/warehouse`, kalit `warehouse`) sahifasida
`negative_stock_policy` select-maydoni — uchala variant ham bor.
`sale/service.py::create_sale_core` sotuv yaratishda shu sozlamani
o'qiydi va `allow`da `_stock_apply`ga `allow_negative=True` beradi
(standart — eski, qattiq belgilangan `block_sale` xatti-harakati
saqlanadi, orqaga moslik buzilmagan). `hide` POS'da butunlay
frontend-tomonlama ishlaydi — `pos/page.tsx` mahsulot ro'yxatini
`total_stock <= 0` bo'yicha filtrlaydi (xizmatlar bundan mustasno).
Production'da API orqali sinaldi.

### Katalogni ko'rsatish turi

Mahsulot (standart — rasm+nom+narx+qoldiq) / Dorixona (+ MNN, ATX,
mamlakat, ishlab chiqaruvchi, seriya, yaroqlilik muddati) /
Yengillashtirilgan (rasmsiz ro'yxat, zaif qurilmalar uchun).

**Aniq ERP holati:** ❌ Yo'q — bitta qattiq belgilangan katalog-ko'rinish
bor, rejim almashtirish yo'q. Aniq ERP dorixona-yo'naltirilgan emas,
shuning uchun "Dorixona" rejimi past ustuvor; "Yengillashtirilgan"
rejim esa sekin qurilma/internet bilan ishlaydigan nuqtalar uchun
foydali bo'lishi mumkin.

### Muddati o'tgan mahsulotlarni sotish siyosati

Sotishga ruxsat berish / Sotishni taqiqlash.

**Aniq ERP holati:** ❌ Hali yo'q — ataylab kechiktirildi (2026-10-14
tahlili). `has_expiration` faqat mahsulot darajasida bitta bayroq;
haqiqiy **muddat sanasi** hech qayerda — na `stock_in_items`da, na
alohida partiya (batch/lot) jadvalida — saqlanmaydi. Buni to'g'ri
qurish uchun avval partiya-darajasidagi muddat-tracking infratuzilmasi
(stock-in'ga `expiry_date`, stock_balances'ni partiya bo'yicha
bo'lish yoki alohida jadval, sotuvda FEFO tanlash) kerak — bu
"kichik sozlama" emas, alohida, kattaroq ombor-modeli ishi.

### Chek sozlamalari

Maxsus chek-toifalari (masalan Kredit, Bo'nak) qo'shish; birinchi chek
rasmiylashtirilganda smenani avtomatik ochish; markirovka kodlarini
qog'oz chekda ko'rsatish yoki yashirish.

**Aniq ERP holati:** ⚠️ tekshirilmadi chuqur — chek shabloni
(`bt-printer.ts`) mavjud, lekin maxsus chek-toifalari/avtomatik smena
ochish funksiyalari aniq ko'rilmadi. Markirovka umuman yo'qligi sababli
bu band tegishli emas.

### Tillar

Interfeys tili: Ruscha / O'zbekcha.

**Aniq ERP holati:** ✅ bor, hatto kengroq — `i18n/messages/` papkasida
uz, ru, uz-cyrl, kaa, en tillari bor (POS ekranida ham `useTranslations`
orqali ishlatiladi).

### Xavfsizlik — parol almashtirish va PIN-kirish

Hisob parolini almashtirish; tezkor kirish uchun PIN-kod sozlash.

**Aniq ERP holati:** ✅ PIN qismi qurildi (2026-10-14). `users.pin_hash`
(bcrypt, 4-6 xonali) + `POST /auth/set-pin`, `DELETE /auth/pin`,
`POST /auth/pin-login` (5/daqiqa rate-limit, 2FA yoqilgan hisoblar
uchun ataylab bloklangan — PIN 2FA'ni aylanib o'tish yo'li bo'lmasligi
kerak). Frontend: `/settings/my-pin` (PIN o'rnatish/o'chirish) va
login ekranida "PIN kod bilan kirish" almashtirgichi. Parolni
almashtirish — odatiy auth oqimida bor deb taxmin qilinadi, alohida
tekshirilmadi.

## Keyingi qadam

Ikkita asosiy band bajarildi: manfiy-qoldiq siyosati va PIN tezkor
kirish. Qolganlar — fiskal rejim, dorixona-ko'rinish rejimi, muddati
o'tgan tovar bloki (partiya-tracking talab qiladi) — ancha kattaroq,
alohida qaror talab qiladigan ishlar, past ustuvorlikda qoldirildi.
