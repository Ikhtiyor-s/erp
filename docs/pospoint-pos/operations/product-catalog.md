# Tovarlar katalogi

Manba: `pospoint.uz/uz/knowledge-base/catalog`

## PosPoint nima qiladi

Do'kondagi barcha pozitsiyalar saqlanadigan yagona baza — qo'shish,
tahrirlash, narx, shtrix-kod, o'lchov birligi, vaznli/markirovkali
belgilash.

### Bo'limlarni boshqarish

Bo'limlar (masalan: sut mahsulotlari, ichimliklar) katalogni tuzishga
yordam beradi; "+Bo'lim" bilan qo'shiladi, faol mahsuloti bo'lmasa
tahrirlanadi/o'chiriladi.

**Aniq ERP holati:** ✅ bor — `warehouse/category` sahifasi.

### Yangi mahsulot qo'shish

Majburiy: nomi. Standart maydonlar: shtrix-kod, bo'lim, sotish narxi,
o'lchov birligi, ustama, xarid narxi; ixtiyoriy: vaznli tovar, markirovka
kerakligi. Fiskal rejimda qo'shimcha majburiy: MXIK, o'lchov birligi,
tovar turi. Dorixona rejimi uchun qo'shimcha maydonlar (mamlakat,
ishlab chiqaruvchi, MNN, ATX, qadoqdagi miqdori).

**Aniq ERP holati:** ✅ bor, deyarli bir xil maydonlar to'plami bilan
— `warehouse/products` sahifasidagi "Yangi mahsulot" formasi: nomi,
shtrix-kod, kategoriya, birlik, sotib olish/sotuv narxi, valyuta,
asosiy ta'minotchi, mahsulot turi/modeli, o'lcham/vazn, quti hajmi (bu
oxirgi ikkitasi PosPoint'da yo'q — Aniq ERP'da **qo'shimcha**). Dorixona-
maxsus maydonlar (MNN, ATX) ❌ yo'q — lekin Aniq ERP dorixona-yo'naltirilgan
emas, bu ustuvor emas.

### Shtrix-kod orqali mahsulotni tezkor kiritish

"Tezkor qo'shish" — shtrix-kod skanerlansa, agar O'zbekiston Tasnif
bazasida (250 000+ pozitsiya) topilsa, nom/MXIK/o'lchov birligi
avtomatik to'ldiriladi; agar "narxni saqlash" o'chirilgan bo'lsa, tovar
erkin narx (=0) bilan bitta skanerlash orqali qo'shiladi.

**Aniq ERP holati:** ❌ Yo'q. Aniq ERP'da O'zbekiston Tasnif/MXIK
ma'lumotlar bazasi bilan integratsiya topilmadi — yangi mahsulot har
doim qo'lda to'liq kiritiladi. Bu katalogga mahsulot kiritish tezligiga
sezilarli ta'sir qiladigan, REGOS hujjatlarida qayd etilmagan yangi gap.

### Mahsulotni tahrirlash / o'chirish

Standart CRUD.

**Aniq ERP holati:** ✅ bor.

### Tanlangan mahsulotlar ("Sevimlilar")

Mahsulot kartochkasida "Tanlangan" svitchi — bunday tovarlar kassada
tezkor qo'shish uchun alohida toifada ko'rsatiladi.

**Aniq ERP holati:** ❌ Yo'q — bu aynan REGOS hujjatida ham qayd
etilgan gap ("⭐ Sevimlilar" pastki-tab, `docs/regos-pos/README.md`da
"Tezkor mahsulotlar"/"Sevimlilar yo'q" deb belgilangan). Ikkala manba
ham mos keladi — bu POS'ning tezkor-savdo tezligiga ta'sir qiladigan,
ikkala raqobatchida ham bor funksiya.

### Mahsulotlarni ommaviy yuklash

Admin paneldan Excel fayli orqali (Nomi + Sotish narxi majburiy).

**Aniq ERP holati:** ✅ bor — import funksiyasi mavjud (`ImportResult`/`ImportError`
turi `warehouse/products/page.tsx`da ko'rinadi).

## Keyingi qadam

Eng qimmatli, ikkala manbada ham (REGOS + PosPoint) takrorlangan gap —
**"Tanlangan/Sevimli mahsulotlar" tezkor-taxta** — bu kichik va tez
qo'shiladigan UI ishi, kassir tezligiga bevosita ta'sir qiladi. Tasnif/
MXIK integratsiyasi kattaroq, alohida ish (tashqi davlat bazasi bilan
integratsiya talab qiladi) — faqat fiskal rejim qurilsa dolzarb bo'ladi.
