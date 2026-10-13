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

**Aniq ERP holati:** ⚠️ qisman. Backend'da ikkilik `allow_negative`
bayrog'i bor (`warehouse/service.py:41` — standart `False`, ya'ni
manfiy qoldiqqa sotishni block qiladi), lekin bu **org darajasida
sozlanadigan, UI'dan tanlanadigan 3-variantli** siyosat emas — kod
darajasida qattiq belgilangan. "Ko'rsatish, lekin sotishga ruxsat
bermaslik" va "umuman yashirish" variantlari aniq amalga oshirilmagan.

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

**Aniq ERP holati:** ❌ Yo'q — `has_expiration` mahsulot darajasida
bor, lekin sotuv vaqtida muddat tekshiruvi/bloklash topilmadi
(`sale/service.py`da bunday tekshiruv yo'q).

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

**Aniq ERP holati:** ⚠️ qisman. Parolni almashtirish odatiy auth
oqimida bor deb taxmin qilinadi (`apps/api/app/modules/auth/router.py`),
lekin ❌ **PIN bilan tezkor kirish** (kassir almashinuvida to'liq
login/parol o'rniga 4-6 xonali kod) umuman yo'q — kodda "pin"/"PIN"
so'zi bo'yicha hech qanday moslik topilmadi.

## Keyingi qadam

Eng amaliy, tez qo'shiladigan ikkita narsa: **manfiy-qoldiq siyosatini
3-variantli UI-sozlamaga aylantirish** (backend infratuzilmasi
qisman bor) va **PIN bilan tezkor kirish** (bir nechta kassir bir
qurilmada almashinganda real tezlik beradi). Fiskal rejim va
dorixona-ko'rinish rejimi — ancha kattaroq, alohida qaror talab
qiladigan ishlar.
