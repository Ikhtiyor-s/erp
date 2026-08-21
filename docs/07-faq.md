# 7. Tez-tez beriladigan savollar (FAQ)

## Umumiy

### Tizim qaysi kompyuterda ishlaydi?
Hozir lokal Docker konteynerlarda — `D:\Docker\projects\erp\` papkasida. Boshqa kompyuterga ko'chirish uchun: docker-compose.yml + apps/ + infra/ ni nusxalang.

### Brauzer qaysi yaxshi ishlaydi?
Chrome, Edge yoki Firefox (oxirgi 12 oylik versiyalar). Safari'da ham ishlaydi.

### Internet kerakmi?
**Yo'q.** Tizim to'liq lokal ishlaydi. Internet faqat:
- CBU valyuta kurslarini yuklash uchun (`cbu.uz`)
- Inter shrift fonti (Google Fonts, ammo browser cache'da saqlanadi)

### Telefondan ishlaydimi?
**Asosan ha** — sahifalar mobil ekranga moslashgan. Ammo POS, katta jadvallar va modallar uchun desktop tavsiya etiladi.

---

## Login va akkaunt

### Parolimni unutdim
Hozir parol tiklash funksiyasi yo'q. DB darajasida:
```sql
UPDATE users SET password_hash = crypt('YangiParol123!', gen_salt('bf'))
WHERE email = 'mening@email.com';
```

Yoki PowerShell orqali:
```powershell
docker exec -it erp-postgres psql -U erp -d erp -c "UPDATE users SET password_hash = ... WHERE email = '...';"
```

### Bir necha tashkilot bo'lsa qanday almashtirish?
Topbar'dagi **Organization Selector** dropdown'dan. Sahifa avtomatik qayta yuklanadi.

### Login qilolmayman, "Wrong email or password"
- Email noto'g'ri yozilgan bo'lishi mumkin
- Parol case-sensitive (katta/kichik harf farqi)
- Yangi user yaratish: `/register`

---

## Sotuv va mijozlar

### Sotuvni o'chirib bo'ladimi?
**Yo'q**, o'chirish ombor va kassa balansini buzadi. O'rniga:
1. **Bekor qilish** — status `cancelled` bo'ladi, qoldiqlar avtomatik qaytariladi
2. **Qaytarish** — yangi hujjat yaratiladi

### Sotuvga keyin to'lov qilsam bo'ladimi?
Ha. Sotuv yaratilganda to'lov sumamasi 0 bo'lishi mumkin. Keyin:
- **Sotuv → Mijoz to'lovlari** dan yangi to'lov
- Yoki sotuv detallarida **To'lash** tugmasi

### Bir mijozga bir nechta sotuv tegishli bo'ladimi?
Albatta. Mijoz balansi avtomatik hisoblanadi:
- Sotuv: +balans (mijoz qarzdor)
- To'lov: −balans

---

## Ombor

### Bir mahsulot bir nechta omborlarda bo'lishi mumkinmi?
**Ha.** `stock_balances` jadvalida har bir (ombor, mahsulot) kombinatsiyasi alohida yozuv.

### Tannarx qanday hisoblanadi?
**Weighted Average** (o'rtacha tortilgan):
```
yangi_avg_cost = (eski_qty * eski_cost + kirim_qty * kirim_cost) / (eski_qty + kirim_qty)
```

Kirim har safar tannarxni qayta hisoblaydi.

### Manfiy qoldiq bo'lishi mumkinmi?
**Texnik jihatdan ha** — agar mavjud bo'lmagan mahsulotni sotsangiz. Lekin UI ogohlantirish bermaydi (kelajakda qo'shamiz). Inventarizatsiya bilan to'g'rilash kerak.

### Inventarizatsiya nima va qanday qilish?
Real qoldiqni tizim qoldiqi bilan moslashtirish.

1. **Ombor → Inventarizatsiya → Yangi**
2. Tizim hozirgi qoldiqlarni ko'rsatadi
3. **Fakt soni** ni qo'lda yozasiz
4. **Yakunlash** — farq avtomatik:
   - Ko'p chiqsa — kirim
   - Kam chiqsa — write-off

---

## Moliya

### Kassalar orasida o'tkazma qaerdan qilinadi?
**Moliya → Kassalar** sahifasida yuqorida **"O'tkazma"** tugmasi.

### Balansni qo'lda o'zgartirish mumkinmi?
**Ha**, lekin bu maslahat berilmaydi. Faqat dastlabki ma'lumotlarni o'rnatish uchun. Sahifalar:
- `/finance/cashbox-set-balance` — kassa
- `/finance/customer-set-balance` — mijoz
- `/finance/supplier-set-balance` — yetkazib beruvchi
- `/finance/employee-set-balance` — xodim

Bu avtomatik korrektirovka tranzaksiyasi yaratadi.

### Bir nechta valyutada ishlash mumkinmi?
**Ha.** Har bir kassa, mahsulot, sotuvga valyuta tegishli. Hisobotlar valyuta bo'yicha guruhlanadi (kelajakda multi-currency aggregation).

---

## Ishlab chiqarish

### BOM (Bill of Materials) nima?
**Retsept.** Tayyor mahsulot uchun kerakli ingredientlar ro'yxati.

Misol: 1 ta pitsa uchun:
- 200g xamir
- 100g pomidor sousi
- 150g pishloq

BOM yarata olganingizdan keyin **Ishlab chiqarish buyurtmasi** ochib, qancha pitsa qilish kerakligini aytasiz.

### Ishlab chiqarish workflow:
1. **Draft** — yangi yaratildi
2. **Boshlash** → `in_progress`
3. **Tugatish** → `completed`:
   - Ingredientlar omborga **chiqim** bo'ladi
   - Tayyor mahsulot omborga **kirim** bo'ladi
   - Tannarx avtomatik hisoblanadi (weighted avg)

---

## HR va KPI

### Xodim balansi nima degani?
Xodim bilan tashkilot orasidagi qarz:
- **Manfiy** — xodim qarzdor (avans olgan, lekin ishlamagan)
- **Musbat** — tashkilot qarzdor (ish haqi to'lanmagan)

### KPI qanday ishlatiladi?
1. **HR → KPI** ga o'ting
2. Yangi KPI: xodim + davr (oy) + metrika nomi + plan + fakt
3. % avtomatik hisoblanadi va rang bilan ko'rsatiladi (yashil/sariq/qizil)

---

## Sozlamalar

### Tilni qayerdan o'zgartirish?
Topbar'dagi **UZ ▾** dropdown — UZ / RU / EN. localStorage'da saqlanadi.

### Yorug' / qorong'i mavzu?
Topbar'da oy/quyosh ikoni → Light / Dark / System.

### Logo qo'shish?
**Sozlamalar → Organization** sahifasida **Logo URL** maydoni. Hozircha URL kiritish (file upload kelajakda).

---

## Tarjima

### Ba'zi matnlar rus tilida qoldi
Ha, ~74 sahifa qisman tarjima qilinmagan (script tegmagan). Reja:
1. Lug'atni yana kengaytirish (200+ kalit)
2. Qolgan sahifalarni qayta o'tkazish

Hozircha ishlatishingiz mumkin — funksional jihatdan to'liq ishlaydi.

### O'zim tarjima qo'shsam bo'ladimi?
Ha:
1. `apps/web/i18n/messages/uz.json` (va ru.json, en.json) — yangi kalitlar qo'shing
2. Sahifada `t("key_name")` ishlatishingiz mumkin (agar `useTranslations` hook bor bo'lsa)

---

## Performance

### Sahifa sekin yuklayapti
- Birinchi marta — Next.js cache'siz, sekin (1-2 sek)
- Keyingi marta — cache'dan tezroq
- Ko'p ma'lumot bo'lsa (1000+ row) — pagination ishlatish

### API sekin javob beradi
- Postgres sekinligi — DB index'lar yetishmasligi
- Network latency — Docker overlay tarmoq
- Yechim: `EXPLAIN ANALYZE` bilan slow query'larni topish

---

## Backup va xavfsizlik

### Ma'lumot yo'qolishi mumkinmi?
Faqat agar:
- `docker compose down -v` qilsangiz (volume o'chirilladi)
- Postgres volume buzilsa

**Yechim:** Kunlik backup (qarang [Admin guide](04-admin-guide.md#backup-va-restore))

### Parolim qancha kuchli bo'lishi kerak?
Kamida 8 ta belgi, 1 ta katta harf, 1 ta raqam. Hozir validatsiya yo'q, lekin tavsiya etiladi.

### HTTPS qaerdan qo'shiladi?
Production deploy uchun Nginx + Letsencrypt. Qarang [Developer guide](05-developer-guide.md#deploy).

---

## Funksiya so'rovi

### "Bir funksiya bor edi, lekin ishlamayapti"
Avval [Troubleshooting](08-troubleshooting.md) ga qarang. Topilmasa — devops bilan bog'laning.

### "Yangi funksiya qo'shish kerak"
Developer guide'da [Yangi modul qo'shish](05-developer-guide.md#yangi-modul-qoshish) bo'limi bor. Dasturchi orqali.

---

## Boshqa

### Qaysi versiya ishlatyapman?
Hozir versiya raqami yo'q (`package.json` da `0.1.0`). Kelajakda CI/CD orqali avtomatik versiyalash.

### Litsenziya
Hozir litsenziya yo'q — ichki ishlatish uchun. Public release bo'lsa MIT yoki Apache 2.0 tavsiya etiladi.
