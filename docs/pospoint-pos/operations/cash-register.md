# Kassa

Manba: `pospoint.uz/uz/knowledge-base/kassa`

## PosPoint nima qiladi

Kassa — asosiy sotuv vositasi: chek rasmiylashtirish, to'lov qabul
qilish, qaytarish, markirovkalangan/vaznli tovar bilan ishlash, chegirma
va qarzga sotish.

### Mahsulot qidirish va chekka kiritish

Nom bo'yicha qidirish yoki shtrix-kod skanerlash — markirovkalangan
tovar bo'lsa, shtrix-kod o'rniga markirovka kodi ham skanerlanishi
mumkin. Topilgan mahsulot avtomatik chekka qo'shiladi; miqdor/narx
chekdagi qatorni bosib tahrirlanadi.

**Aniq ERP holati:** ✅ bor — `pos/page.tsx`dagi qidiruv (F3) + skaner
(`scannerEnabled`) + narx/miqdorni qator ustida tahrirlash. Markirovka
kodi alohida skan-rejimi sifatida ❌ yo'q (faqat oddiy shtrix-kod).

### To'lov va sotuvni rasmiylashtirish

"To'lov" tugmasi → usul tanlash (naqd/karta/onlayn — Payme/Click/Uzum)
→ tizim avtomatik chek chop etadi. Tezkor "Naqd pul"/"Karta" tugmalari.

**Aniq ERP holati:** ✅ bor — `pos/page.tsx`dagi to'lov-turi tugmalari
(`paymentTypes`, dinamik), "To'lov (F8)" + chek chop etish
(`printReceipt`).

### Tovarni qarzga sotish

To'lov oynasida "Qarzga" usuli → mijoz ko'rsatiladi (yoki joyida
yaratiladi) → mijoz kartochkasidagi qarz limiti oshsa, kassa sotuvni
qarzga rasmiylashtirishga ruxsat bermaydi.

**Aniq ERP holati:** ⚠️ qisman. Mijozlar tizimida qarz/balans tushunchasi
bor (`customer/*` moduli), lekin POS to'lov oynasida REGOS/PosPoint'dagi
kabi **"Qarzga" alohida to'lov-usuli** sifatida ko'rinmaydi — kassir buni
to'g'ridan-to'g'ri to'lov ekranidan bir bosishda qila olmaydi. Qarz-limit
enforcement (limit oshsa rad etish) ham POS darajasida tekshirilmagan.

### Onlayn kassa (fiskal rejim)

Fiskal rejim yoqilganda barcha cheklar majburiy fiskallashtiriladi
(Sozlamalar → Umumiy sozlamalar → Kassa rejimi).

**Aniq ERP holati:** ❌ Yo'q. Kodda "fiscal"/"fiskal" so'zi bo'yicha
qidiruv hech narsa topmadi — hech qanday fiskal registrator/modul
integratsiyasi yo'q. Bu Aniq ERP uchun REGOS hujjatlarida ham qayd
etilmagan, yangi aniqlangan gap.

### Mahsulotni qaytarish

Cheklar jurnalidan kerakli chek topiladi, qaytariladigan
mahsulot/miqdor belgilanadi, to'lov-qaytarish usuli ko'rsatiladi.

**Aniq ERP holati:** ✅ bor — `pos/page.tsx`dagi "Qaytarish" (F5),
`/sale/return` sahifasiga olib boradi.

### Chegirmani qo'llash

Mahsulotga (qator darajasida) yoki butun chekka (% yoki summa) chegirma.

**Aniq ERP holati:** ✅ **qisman** — xuddi REGOS hujjatida qayd
etilganidek, butun-hujjat darajasidagi chegirma bor (`startDiscountEntry`),
qator darajasidagi chegirma ❌ hali yo'q. Batafsil: [`docs/regos-pos/operations/additional-functions.md`](../../regos-pos/operations/additional-functions.md).

### Markirovka kodini tekshirish

"Markirovka" tugmasi yoqilsa, markirovkalangan tovar chekka
qo'shilganda kod tekshiriladi; bunday tovarlar katalogda maxsus belgi
bilan ko'rsatiladi.

**Aniq ERP holati:** ❌ Yo'q — bu REGOS hujjatida ham (`project_erp_regos_pos_workflow.md`,
"Belgilangan tovar (UZ markirovka) oqimi") qayd etilgan, hali qurilmagan
gap. Ikkala manba ham buni tasdiqlaydi.

### Tarozi bilan ishlash

Tarozi ulangan bo'lsa, vaznli tovar chekka qo'shilganda tizim avtomatik
tarozini o'qiydi; vaznli tovarlar katalogda belgi bilan ko'rsatiladi.

**Aniq ERP holati:** ⚠️ qisman — `connectScale()`/og'irlik oqimi bor
(`apps/web/lib/bt-printer.ts`), lekin PosPoint/REGOS'dagi kabi avtomatik
"vaznli tovar qo'shilganda avtomatik tarozi o'qiladi" integratsiyasi
aniq ko'rilmadi (hozir qo'lda ulanadi). Batafsil: [`docs/regos-pos/operations/additional-functions.md`](../../regos-pos/operations/additional-functions.md#весы-tarozi).

### Chekni qanday kechiktirish mumkin

"Chekni kechiktirish" tugmasi — chek saqlanadi, keyinroq "Kechiktirilgan
cheklar" menyusidan qaytib ochiladi.

**Aniq ERP holati:** ✅ qurildi — bu aynan REGOS parity ishida
"Kutish rejimi"/"Kutayotganlar" nomi bilan 2026-10-13da qo'shilgan
funksiya bilan bir xil. Batafsil: [`docs/regos-pos/operations/sessions.md`](../../regos-pos/operations/sessions.md).

## Keyingi qadam

PosPoint'ning kassa bo'limida REGOS hujjatlarida bo'lmagan yangi narsa
kam — asosiy farq **fiskal rejim** (butunlay yo'q) va **"Qarzga" to'lov
usulining POS to'lov oynasiga chiqarilmaganligi**. Ikkalasi ham alohida
ticket talab qiladi, lekin ustuvorligi foydalanuvchi tasdiqlashiga
bog'liq (fiskal integratsiya ayniqsa katta ish — soliq/kassalar reestri
bilan ishlash talab qiladi).
