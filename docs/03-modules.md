# 3. Modullar bo'yicha qo'llanma

ERP tizimida 15 ta asosiy modul mavjud. Har birining vazifasi va asosiy sahifalari.

## Mundarija

- [Bosh sahifa](#bosh-sahifa)
- [Sotuv](#sotuv) — 5 sahifa
- [Moliya](#moliya) — 24 sahifa
- [Ombor](#ombor) — 19 sahifa
- [Mijozlar](#mijozlar) — 7 sahifa
- [Ta'minot](#taminot) — 3 sahifa
- [Ishlab chiqarish](#ishlab-chiqarish) — 4 sahifa
- [Xodimlar (HR)](#xodimlar-hr) — 4 sahifa
- [Marketing](#marketing) — 2 sahifa
- [Ma'lumotnoma](#malumotnoma) — 5 sahifa
- [Statistika](#statistika) — 18 sahifa
- [Asboblar](#asboblar) — 2 sahifa
- [Vazifalar](#vazifalar)
- [POS](#pos)
- [Sozlamalar](#sozlamalar) — 21 sahifa

---

## Bosh sahifa

**URL:** `/dashboard`

KPI kartochkalari:
- Bugungi sotuvlar soni
- Bugungi tushum
- Oylik sotuvlar
- Oylik tushum
- Kassalardagi jami

---

## Sotuv

| Sahifa | URL | Vazifa |
|---|---|---|
| Sotuv paneli | `/sale/dashboard` | KPI + 30 kunlik grafik + top mijozlar/mahsulotlar |
| Kontraktlar / Buyurtmalar | `/sale/contract` | Asosiy sotuvlar ro'yxati, yangi sotuv yaratish |
| Qaytarishlar | `/sale/return` | Sotuv qaytarishlari |
| Qaytarish sabablari | `/sale/return-reason` | Sabab ma'lumotnomasi |
| Mijoz to'lovlari | `/sale/customer-payments` | Sotuvlarga qabul qilingan to'lovlar |

### Asosiy oqim: Sotuv → To'lov → Qaytarish

1. `/sale/contract` da yangi sotuv yarating
2. Mijoz pul to'laydi → `/sale/customer-payments` yoki to'g'ridan kassa orqali
3. Agar tovar qaytarilsa → `/sale/return` da qaytarish hujjati

---

## Moliya

24 sahifa — eng katta modul. Asosiy guruhlar:

### Asosiy
- **Kassalar** (`/finance/cash`) — kassalar ro'yxati, balanslari, operatsiya
- **Tranzaksiyalar** (`/finance/transaction`) — barcha kirim-chiqim
- **Hisob-fakturalar** (`/finance/invoice`)
- **Shartnomalar** (`/finance/contract`)
- **Valyutalar** (`/finance/currency`) — CBU kurslarini avtomatik yuklash
- **To'lov turlari** (`/finance/payment-type`)
- **Qo'shimcha xarajatlar** (`/finance/extra-cost`) — ijara, kommunal va h.k.

### Balans belgilash (set-balance)
Balansni qo'lda tahrirlash uchun:
- **Kassalar** (`/finance/cashbox-set-balance`)
- **Mijoz** (`/finance/customer-set-balance`)
- **Xodim** (`/finance/employee-set-balance`)
- **Yetkazib beruvchi** (`/finance/supplier-set-balance`)
- **Jismoniy shaxs** (`/finance/person-set-balance`)

### Balans hisobotlari
- **Mijoz balansi** (`/finance/customer-balance`) — qarzdor va ortiqcha to'laganlar
- **Xodim balansi** (`/finance/employee-balance`)
- **Yetkazib beruvchi balansi** (`/finance/supplier-balance`)
- **Shaxs balansi** (`/finance/person-balance`)

### Aylanma hisobotlari
- **Kassa aylanmasi** (`/finance/cashbox-turnover-report`)
- **Mijoz aylanmasi** (`/finance/customer-turnover-report`)
- **Xodim aylanmasi** (`/finance/employee-turnover-report`)
- **Yetkazib beruvchi aylanmasi** (`/finance/supplier-turnover-report`)
- **Shaxs aylanmasi** (`/finance/person-turnover-report`)

### Statistika
- **Balans statistikasi** (`/finance/statistics-balance`) — snapshot
- **Pul oqimi** (`/finance/statistics-cash-flow`) — kunlik kirim/chiqim grafigi
- **ABC tahlil** (`/finance/statistics-abc-analysis`)
- **Narx farqi** (`/finance/price-deviation-report`) — reja vs fakt narx

---

## Ombor

19 sahifa. 4 ta asosiy guruh:

### Mahsulot katalogi
- **Mahsulotlar** (`/warehouse/products`) — to'liq katalog
- **Xom ashyo** (`/warehouse/material`) — `kind=material`
- **Yarim tayyor** (`/warehouse/semi-product`) — `kind=semi`
- **Xizmatlar** (`/warehouse/services`) — `is_service=true`
- **Kategoriyalar** (`/warehouse/category`)

### Omborlar
- **Omborlar** (`/warehouse/warehouses`) — Mas'ul + zaxira qiymati JOIN
- **Ombor turlari** (`/warehouse/types`) — magazin / sex / optom

### Hujjatlar
- **Kirim** (`/warehouse/income`) — yetkazib beruvchidan
- **Inventarizatsiya** (`/warehouse/revision`) — qoldiqlar sverkasi
- **Hisobdan chiqarish** (`/warehouse/write-off`)
- **Hisobdan chiqarish sabablari** (`/warehouse/write-off-reason`)
- **Ichki ko'chirish** (`/warehouse/internal-transfers`)

### Hisobotlar
- **Mahsulot qoldiqlari** (`/warehouse/product-warehouses`)
- **Tavsiya qoldiq** (`/warehouse/recommended-stock`) — minimal zaxira
- **Qoldiq hisoboti** (`/warehouse/in-stock-report`)
- **Mahsulot statistikasi** (`/warehouse/product-statistic`)
- **Tannarx** (`/warehouse/cost-of-goods`)
- **Mahsulot daromadi** (`/warehouse/product-income`) — Profit per product
- **Hisobdan chiqarish hisoboti** (`/warehouse/write-off-report`)

---

## Mijozlar

| Sahifa | Vazifa |
|---|---|
| **Mijozlar** (`/customer/customers`) | Asosiy mijozlar bazasi, CSV import/export |
| **Mijoz profili** (`/customer/customers/[id]`) | Balans, sotuvlar, operatsiyalar tarixi |
| **Buyurtmalar** (`/customer/orders`) | Mijoz buyurtmalari (status workflow bilan) |
| **Kategoriyalar** (`/customer/category`) | Mijozlar segmentatsiyasi + skidka % |
| **Manzil** (`/customer/location-customer`) | Filiallar bo'yicha mijozlar |
| **ABC/XYZ tahlil** (`/customer/abc-xyz-analysis`) | Klassifikatsiya |
| **Analitika** (`/customer/customers-analytics-dashboard`) | Yangi/aktiv mijozlar, top-10, o'rtacha chek |
| **Keshbek aylanmasi** (`/customer/cashback-turnover-report`) | Sadoqat dasturi |

---

## Ta'minot

| Sahifa | Vazifa |
|---|---|
| **Sotib olishlar** (`/supply/purchases`) | Yetkazib beruvchidan kirim |
| **Sotib olish buyurtmasi** (`/supply/purchase-order`) | Order workflow: new → sent → received |
| **Yetkazib beruvchilar** (`/supplier/suppliers`) | Asosiy baza |

---

## Ishlab chiqarish

| Sahifa | Vazifa |
|---|---|
| **Ishlab chiqarish buyurtmalari** (`/manufacturing/orders`) | Order lifecycle: draft → start → finish |
| **Tarkib (BOM)** (`/manufacturing/ingredient`) | Retsept (Bill of Materials) |
| **Holat hisoboti** (`/manufacturing/state-report`) | Statuslar bo'yicha |
| **Mas'ul bo'yicha** (`/manufacturing/production-by-responsible`) | Progress bar bilan |

### Asosiy oqim
1. **BOM yarating** (`/manufacturing/ingredient`) — retsept va ingredientlar
2. **Buyurtma yarating** (`/manufacturing/orders`) — qancha ishlab chiqamiz
3. **Boshlash** → status `in_progress`
4. **Tugatish** → ingredientlar omborga -, tayyor mahsulot omborga +, weighted avg cost hisoblanadi

---

## Xodimlar (HR)

| Sahifa | Vazifa |
|---|---|
| **Xodimlar** (`/hr/employees`) | Kadrlar bazasi |
| **Xodim profili** (`/hr/employees/[id]`) | Balans, ishlab chiqarish, KPI, kassa operatsiyalari |
| **Lavozimlar** (`/hr/positions`) | Xodim soni + o'rtacha maosh JOIN |
| **Rollar** (`/hr/role`) | Tizim rollari |
| **KPI** (`/hr/kpi`) | Maqsad va fakt, % progress bar |

---

## Marketing

| Sahifa | Vazifa |
|---|---|
| **Chegirmalar** (`/marketing/discount`) | Aksiyalar, foiz/summa, davr |
| **Kutilayotgan mahsulotlar** (`/marketing/expected-products`) | Yetkazilishi kutilayotgan tovarlar |

---

## Ma'lumotnoma

| Sahifa | Vazifa |
|---|---|
| **O'lchov birliklari** (`/reference/units`) |
| **Manzillar / filiallar** (`/reference/locations`) |
| **Yuridik shaxslar** (`/reference/legal-entity`) | STIR, bank, direktor |
| **Jismoniy shaxslar** (`/reference/natural-person`) | Pasport, PINFL |
| **Narx ro'yxatlari** (`/reference/prices`) | Bir nechta prays-listlar |

---

## Statistika

18 ta hisobot:

| Sahifa | Tavsif |
|---|---|
| Panel | Umumiy ko'rinish |
| Sotuvlar | Dinamika |
| Kassa | Operatsiyalar |
| Mahsulotlar | Top |
| Kategoriyalar bo'yicha | Discount |
| Xodim bo'yicha | Kassir sotuvlari |
| Mijozlar bo'yicha | Sotuvlar |
| To'lov turi bo'yicha | Naqd vs karta |
| Mahsulot savdosi | Sotib olishlar + sotuvlar |
| Mijoz savdosi | Aylanma |
| Mijoz sotuvlari | Cheklar |
| Mijoz faolligi | Oxirgi xarid |
| Sotilmagan mahsulotlar | Zaxiraga botgan |
| Vositachilik | Posrednik daromadi (placeholder) |
| Qoldiq tarixi | Dinamika |
| Ishlab chiqarish | Output |
| Mas'ul bo'yicha | Buyurtmalar |
| Tavsiya ishlab chiqarish | Nima ishlab chiqarish kerak |

Har bir hisobotda sana filtri va CSV eksport (ko'pchiligida).

---

## Asboblar

| Sahifa | Vazifa |
|---|---|
| **Narx belgilash** (`/tools/price`) | Massa naqlash/chegirma (foiz) |
| **Eksport markazi** (`/tools/exports-center`) | 5 ta CSV |

### Narx belgilash misol
- Tanlang **Cha narxi** yoki **Sotuv narxi**
- **+10%** kiriting — barcha mahsulotlarda 10% qimmatlashadi
- **−5%** — 5% chegirma
- **Kategoriya ID** bering — faqat shu kategoriya mahsulotlariga ta'sir qiladi

---

## Vazifalar

**URL:** `/tasks`

To-do tizimi:
- **Sarlavha + tavsif**
- **Mas'ul xodim**
- **Prioritet:** past / oddiy / yuqori / shoshilinch
- **Muddat**
- **Status workflow:** К выполнению → В работе → Выполнено / Отменено

Status almashtirish — qator yonidagi ikon tugmalar (`▶ ✓ ✕`).

---

## POS

**URL:** `/pos`

Kassirning asosiy ish stoli:
- **Yuqorida** — ombor + kassa + mijoz tanlash
- **O'rta-chap** — mahsulotlar (qidiruv bilan filtr)
- **O'ng** — korzina (Oplata yashil tugma)

Tovar narxi va shtrix-kodi avtomatik to'ldiriladi. Cheklar `/sale/contract` da paydo bo'ladi.

---

## Sozlamalar

21 sahifa. Asosiy guruhlar:

### Tashkilot
- **Organization** (`/settings`) — kompaniya rekvizitlari
- **CRM** (`/settings/crm`) — Telegram, teglar
- **Obuna** (`/settings/subscription`) — tarif

### Sotuv va Chek
- **Umumiy** (`/settings/general`) — til, valyuta, vaqt zonasi
- **To'lov usuli** (`/settings/payment-method`)
- **Chek** (`/settings/receipt`) — chek formati
- **Sotuv** (`/settings/sale-options`) — defaultlar
- **Ochiq cheklar** (`/settings/open-receipts`)

### SMS va xabarlar
- **SMS** (`/settings/sms`) — gateway
- **Marketing SMS** (`/settings/marketing-sms`)
- **Napominania** (`/settings/customer-reminders`)

### Qurilmalar
- **Qurilmalar** (`/settings/devices`) — printer, scanner
- **Xavfsizlik** (`/settings/device-security`)
- **Tarozi** (`/settings/scale`)
- **Yorliq** (`/settings/label`) — shtrix-kod formati
- **Chop shablonlari** (`/settings/print-templates`)

### Marketing va to'lov
- **Sadoqat kartasi** (`/settings/loyalty`)
- **Onlayn to'lovlar** (`/settings/online-payments`) — Click, Payme
- **Hisoblash parametrlari** (`/settings/calc-params`)
- **Marketpleys** (`/settings/marketplace`)
- **Ombor** (`/settings/warehouse`)
