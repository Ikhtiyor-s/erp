# 2. Foydalanuvchi qo'llanmasi

Kundalik ishlar bo'yicha qadam-baqadam yo'riqnomalar.

## Mundarija

1. [Mahsulot qo'shish](#mahsulot-qoshish)
2. [Mijoz yaratish](#mijoz-yaratish)
3. [Sotuv qilish](#sotuv-qilish)
4. [Sotuvni qaytarish](#sotuvni-qaytarish)
5. [Mijoz to'lovini qabul qilish](#mijoz-tolovini-qabul-qilish)
6. [Tovar kirim qilish (yetkazib beruvchidan)](#tovar-kirim-qilish)
7. [Kassa orasida o'tkazma](#kassa-orasida-otkazma)
8. [Sotuvni o'chirish va to'g'rilash](#sotuvni-ochirish-va-togrilash)
9. [Hisobot eksport qilish](#hisobot-eksport-qilish)
10. [POS-da tez sotuv](#pos-da-tez-sotuv)

---

## Mahsulot qo'shish

**Sahifa:** Ombor → Mahsulotlar

### Bir mahsulot qo'shish
1. Yuqori-o'ng burchakdagi **+ Yaratish** tugmasini bosing
2. To'ldiring:
   - **Nomi** (majburiy)
   - **SKU** — ichki kod (ixtiyoriy lekin tavsiya etiladi)
   - **Shtrix-kod** — agar bor bo'lsa
   - **Cha narxi** (Цена закупа) — o'rtacha tannarx
   - **Sotuv narxi** — qancha sotyapsiz
   - **Valyuta** — UZS, USD va h.k.
   - **Birlik** — dona, kg, litr
   - **Kategoriya** — agar bor bo'lsa
   - **Xizmatmi?** — agar xizmat bo'lsa (omborda saqlanmaydi)
3. **Saqlash** ni bosing

### CSV orqali ko'p mahsulot import qilish
1. **Asboblar → Eksport markazi** ga o'ting
2. **Mahsulotlar CSV** ni yuklab oling — bu shablon
3. Excel'da ochib, mahsulotlarni qo'shing
4. Saqlang va orqaga qaytaring (hozircha CSV import faqat asbob orqali, batafsil yo'l: API).

---

## Mijoz yaratish

**Sahifa:** Mijozlar → Mijozlar

1. **+ Yaratish** ni bosing
2. Asosiy maydonlar:
   - **F.I.O / Nom** — majburiy
   - **Kod** — ixtiyoriy (uy/firma raqami)
   - **Telefon** — +998 formatida
   - **STIR / ИНН** — agar yuridik shaxs bo'lsa
   - **Kategoriya** — VIP, oddiy, optom va h.k.
   - **Manzil**
3. **Saqlash**

### Mijoz profilini ko'rish

Mijozlar ro'yxatida har bir satrning o'ng tomonida 👁 (ko'z) ikoni — bosing va shu mijoz haqida to'liq ma'lumotni ko'ring:
- **Asosiy ma'lumot** — STIR, telefon, manzil
- **Balans** — bizdan qarz yoki bizga qarz (rang bilan)
- **Sotuvlar** — soni va summasi
- **Oxirgi sotuvlar** (30 ta)
- **Operatsiyalar tarixi** — kassadagi to'lovlar (50 ta)

---

## Sotuv qilish

### Variant 1: Klassik (Sotuv → Kontraktlar → Yangi)

1. **Sotuv → Kontraktlar** ga o'ting
2. **+ Yangi sotuv** ni bosing
3. To'ldiring:
   - **Mijoz** — tanlang yoki "Chakana" deb qoldiring (kerak bo'lmasa)
   - **Ombor** — qaysi omborlardan sotyapsiz
   - **Kassa** — qaysi kassaga pul tushadi
   - **Sana** — sotuv sanasi
4. Mahsulotlar qo'shish:
   - **+ Qator qo'shish**
   - Har bir qator: mahsulot, soni, narxi
5. **Saqlash** — sotuv yaratiladi (status: tasdiqlangan)
6. **To'lov qilish** (alohida modal)

### Variant 2: POS (tez kassa)

1. **POS** ga o'ting
2. Yuqorida ombor + kassa + mijoz (yoki "Chakana") tanlang
3. Mahsulotlarni qidirish maydoniga yozing yoki kartochkasini bosing
4. Korzina o'ng tomonda — sonni o'zgartirish mumkin
5. **Oplata** (yashil tugma) — sotuv yopiladi va kassa balansi oshadi

### Variant 3: Buyurtmadan (Mijozlar → Buyurtmalar)

Agar avval **buyurtma** qabul qilgan bo'lsangiz (mijoz oldindan buyurtma bergan):
1. **Mijozlar → Buyurtmalar** dan kerakli buyurtmani toping
2. Status ni **"Yetkazildi"** ga o'tkazing
3. Bu avtomatik sotuv yaratadi (kelajakda)

---

## Sotuvni qaytarish

**Sahifa:** Sotuv → Qaytarishlar

1. **+ Yangi qaytarish** ni bosing
2. Tanlash:
   - **Asl sotuv** — qaysi sotuvni qaytarmoqdamiz
   - **Sabab** (kategoriya) — defektli, mijoz fikr o'zgardi va h.k.
   - **Ombor** — qaysi omborga qaytariladi
3. Qaytariladigan mahsulotlarni tanlang (yoki hammasini)
4. **Saqlash** — qaytarish hujjati yaratiladi
5. Mahsulotlar ombor qoldig'iga qaytadi va mijoz balansi qaytadi

---

## Mijoz to'lovini qabul qilish

**Sahifa:** Sotuv → Mijoz to'lovlari

Yoki: Moliya → Tranzaksiyalar dan **Yangi operatsiya**

1. **Yangi operatsiya** ni bosing
2. To'ldiring:
   - **Kassa** — qaysi kassaga pul tushadi
   - **Tur** — **Kirim** (Приход)
   - **Sumamasi**
   - **Tavsif** — "Mijoz to'lovi", sotuv raqami
   - **Mijoz** (ixtiyoriy lekin tavsiya etiladi)
   - **Sotuv** — qaysi sotuv uchun
3. **Saqlash** — pul kassada, mijoz balansida hisobga olinadi

---

## Tovar kirim qilish

**Sahifa:** Ta'minot → Sotib olishlar → Yangi

1. **+ Yangi sotib olish** ni bosing
2. To'ldiring:
   - **Yetkazib beruvchi**
   - **Ombor** — qayerga keladi
   - **Sana**
3. Mahsulotlar:
   - Har bir qator: mahsulot, soni, sotib olingan narx
4. **Saqlash** — kirim qabul qilinadi:
   - Ombor qoldig'i oshadi
   - O'rtacha tannarx qayta hisoblanadi (weighted average)
   - Yetkazib beruvchi balansi yangilanadi (biz qarzdor bo'lib qolamiz)

### Yetkazib beruvchiga to'lash

Moliya → Tranzaksiyalar → Yangi operatsiya:
- **Tur:** Chiqim
- **Yetkazib beruvchi:** tanlang
- **Sumamasi**

---

## Kassa orasida o'tkazma

**Sahifa:** Moliya → Kassalar → **O'tkazma** tugmasi (yuqorida)

1. **Qaerdan** (manba kassa)
2. **Qayerga** (manzil kassa)
3. **Sumamasi**
4. **Tavsif**
5. **O'tkazish** — 2 ta tranzaksiya yaratiladi (chiqim + kirim)

---

## Sotuvni o'chirish va to'g'rilash

⚠️ **Diqqat:** Tasdiqlangan sotuvni to'liq o'chirib bo'lmaydi (ombor va kassa balanslari buziladi). O'rniga:

### Variant 1: Qaytarish qilish
Yuqoridagi "Sotuvni qaytarish" bo'limiga qarang.

### Variant 2: Bekor qilish (Cancel)
Sotuvlar ro'yxatida sotuvni oching → **Bekor qilish** tugmasi.
- Status: `cancelled` bo'ladi
- Ombor qoldig'i avtomatik qaytariladi
- Kassadagi to'lov ham qaytariladi (agar to'langan bo'lsa)

### Tahrirlash
Hozircha tasdiqlangan sotuvni tahrirlash imkoni yo'q. To'g'rilash uchun: **bekor qilish + yangidan yaratish**.

---

## Hisobot eksport qilish

### CSV (Asboblar)

**Asboblar → Eksport markazi** — 5 ta tayyor CSV:
- Mahsulotlar
- Mijozlar
- Yetkazib beruvchilar
- Sotuvlar
- Qoldiqlar

Kartochkani bosing — fayl avtomatik yuklanadi.

### Hisobotlar (Statistika)

**Statistika** menyusida 18 ta tayyor hisobot:
- Sotuvlar dinamikasi
- ABC tahlil
- Mijoz faolligi
- Sotilmagan tovarlar
- Va boshqalar

Har bir hisobotda **Davr tanlash** (С даты — По дату) bor.

### PDF (Print)

Brauzerda `Ctrl+P` (yoki sahifa o'rta-yuqorisida **Печать**) — PDF saqlash mumkin.

---

## POS-da tez sotuv

**Sahifa:** POS

POS — eng tez yo'l. Kassir uchun mo'ljallangan.

### Bir martalik sozlash
1. POS sahifaga kirganda yuqoridagi 3 ta tanlovni qiling:
   - Ombor (qayerdan sotyapsiz)
   - Kassa (qayerga pul tushadi)
   - Mijoz (ixtiyoriy)

### Har sotuv
1. **Qidirish** maydoniga mahsulot nomi yoki shtrix-kodni yozing
2. Mahsulot kartochkasini bosing — korzinaga qo'shiladi
3. Soni o'ng tomonda (`+` / `−` tugmalari)
4. Bir mahsulotni o'chirish — qator yonidagi 🗑
5. **Itog'i** o'ngda avtomatik hisoblanadi
6. **Oplata** (yashil tugma) — sotuv yopiladi

### Yorliqlar
- Mahsulot kartochkasini bosish — +1 ta korzinaga
- Qidiruvni filter sifatida ishlatish (real-time)
- Korzina bo'sh bo'lsa — sotuv yopilmaydi

---

## Maslahatlar

### 🔍 Tezkor qidiruv
Ekranning istalgan joyida `⌘K` (yoki Ctrl+K) bosing — istalgan sahifaga 2 ta tugma bilan o'ting.

### 🌐 Til o'zgartirish
Topbar'da til menyusi (UZ ▾) — UZ/RU/EN dan birini tanlang. Menyu va asosiy matnlar darrov o'zgaradi.

### 🌙 Qorong'i mavzu
Topbar'da mavzu ikoni (oy/quyosh) — Light / Dark / System (avtomatik) tanlash.

### 💾 Avtomatik saqlash
Formada xato bo'lsa Toast (qizil) ko'rinadi. Muvaffaqiyatli saqlanganda yashil "Saqlandi".

### ⌨ Yorliqlar
- `Esc` — modalni yopish
- `Enter` (qidiruvda) — birinchi natijani ochish
- `⌘K` — qidiruv

### 📱 Mobil
UI mobil ekranda ham ishlaydi, lekin POS va katta jadvallar uchun desktop tavsiya etiladi.
