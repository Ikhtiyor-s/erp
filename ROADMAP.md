# Aniq ERP — Yo'l xaritasi (Roadmap)

**Holat sanasi:** 2026-06-22
**Mavjud versiya:** v1.0 (153 sahifa, 67 jadval, UZ/RU/EN i18n 100%, multi-tenant, RBAC, audit, PDF, Excel)

---

## 📈 Progress Log

### 2026-06-22 — Sessiya yutuqlari

| # | Vazifa | Holat | Tafsilot |
|---|--------|-------|----------|
| 1 | **PDF chek + hisob-faktura** | ✅ Tugadi | 3 format (A4, 80mm, 58mm) — `reportlab` + `qrcode`, DejaVu shrift, sotuv detalida 5 ta tugma |
| 2 | **Excel .xlsx eksport** | ✅ Tugadi | `openpyxl` — sarlavha formatlanagn, avtomatik filter, frozen header, number format. 5 endpoint (`?format=xlsx`) |
| 3 | **Audit log** | ✅ Tugadi | `log_action()` + 3 endpoint + `/tools/audit` UI (filter, pagination, JSON diff modal). Sale operatsiyalariga (`create/pay/cancel/duplicate`) ulangan |
| 4 | **RBAC** | ✅ Tugadi | 67 ruxsat + 6 rol (superadmin/admin/manager/accountant/cashier/viewer) + 221 grant. `require_permission()` dependency. Frontend `PermissionsProvider` + sidebar avto-filter. `/settings/users` + `/settings/roles` sahifalari |
| 5 | **Telegram bot** | ✅ Kod tayyor | `telegram.py` — `notify_sale()` + webhook + komandalar (`/start`, `/balans`, `/sotuv`, `/yordam`). Real bot token kerak ishga tushirish uchun |

---

## 🚧 Tashqi credentials KUTILMOQDA

Quyidagi vazifalar **kod tomondan tayyor** yoki **boshlash mumkin**, lekin ishga tushishi uchun tashqi credentials/shartnoma kerak:

### Telegram bot
- ✅ Kod yozildi (`apps/api/app/modules/integration/telegram.py`)
- ❌ Kerak: **Bot token** (@BotFather'dan oling) + **kanal ID** (botni kanalga admin sifatida qo'shing)
- Sozlash joyi: Sozlamalar → CRM → Telegram bot token
- Webhook URL'i: `https://<sizning-host>/api/v1/integration/telegram/webhook/ANIQ`

### Click integratsiyasi
- ❌ Kerak: **Merchant ID**, **Service ID**, **Secret Key** (Click Merchant Cabinet'dan)
- Webhook URL'i bo'ladi: `https://<host>/api/v1/integration/click/webhook`
- Sozlash joyi: Sozlamalar → Onlayn to'lovlar

### Payme integratsiyasi
- ❌ Kerak: **Merchant ID**, **Secret Key** (business.payme.uz'dan)
- Receipts API
- Webhook URL'i: `https://<host>/api/v1/integration/payme/webhook`

### Apelsin integratsiyasi
- ❌ Kerak: **API Key** (Apelsin Cabinet'dan)

### Soliq.uz E-invoice
- ❌ Kerak: **Soliq cabinet login** + **elektron sertifikat** (`.pfx` fayl)
- Test muhit: `https://test.tax.uz`
- Production: `https://my.tax.uz`

### Bank API integratsiyasi
- ❌ Har bank uchun alohida shartnoma + API kalitlari:
  - Asaka Bank — Open Banking API
  - Ipoteka Bank — OFD API
  - Hamkor Bank — Internet banking
  - Davr Bank, Kapital Bank — alohida sozlash

### SMS provayder
- ❌ Kerak biri: **Eskiz.uz** / **Play Mobile** / **SMSD** dan API key
- Marketing SMS, mijoz eslatmalari, OTP login (customer portal uchun)

### AI assistent
- ❌ Kerak: **Anthropic API key** (yoki OpenAI)
- Hisobotlar ustida tabiiy tilda savol-javob
- Anomaliyalar/prognoz

### Yetkazib berish
- ❌ Yandex Delivery — partner shartnoma
- Express24 — biznes akkaunt
- BTS Express

---

## 🔵 Kelgusi qadamlar (credentials kerak emas)

Hozir darhol boshlash mumkin:

1. **Customer portal** (~10-15h) — mijoz alohida login (OTP), o'z balansini ko'rish, sotuv tarixi, buyurtma yuborish
2. **AI assistent UI** (~4-6h) — chat oynasi (Claude API'sini keyin ulash)
3. **WebSerial/WebUSB qurilma** (~4-6h) — POS sahifaga barcode skaner + tarozi listener
4. **Marketing SMS template engine** (~3-4h) — kampaniyalar yaratish UI (yuborish SMS providerga bog'liq)
5. **Audit middleware** (~2h) — barcha modullarga avto-logging (hozir faqat Sale modulda)
6. **PDF: qaytarish hujjati, inventarizatsiya, hisob-faktura** (~3h) — PDF generatorni boshqa hujjatlarga kengaytirish
7. **xlsx: ko'p sheet** (~2h) — bir faylga 3 sheet (sotuvlar+items+to'lovlar)
8. **Test data seed kengaytirish** (~2h) — yana 100+ sotuv, 50+ qaytarish, 30+ ishlab chiqarish buyurtma
9. **Production Dockerfile optimallashtirish** (~3h) — multistage size, security hardening
10. **Alembic migrations** (~4h) — `init.sql` ni Alembic'ga migratsiya

---

## ⚠️ Ma'lum muammolar (texnik qarz)

| Muammo | Tafsilot | Tuzatish vaqti |
|--------|----------|---------|
| **i18n keys Russian** | 67 ta i18n key nomi ichida Russian so'zlar bor (`ui__сотрудник_xxx`). Qiymatlar UZ, lekin kalit nomi RU. Bu ishlab chiqarishga ta'sir qilmaydi — faqat kod ko'rinishi. | ~6h (153 TSX fayl `t()` chaqirig'ini yangilash) |
| **Raw SQL** | `text()` orqali — Alembic/ORM yo'q. Schema o'zgartirish qo'lda. | ~10h |
| **Test yo'q** | Pytest/Playwright sozlanmagan. Manuel tekshirilmoqda. | ~20h |
| **Audit faqat Sale modulda** | `log_action()` chaqirig'i Warehouse, Finance, Customer modullarda yo'q. | ~3h (har modulga ulash) |
| **Permission har endpointda majburiy emas** | `require_permission()` Sale modulda ishlatilgan, boshqa modullarda yo'q. Hozir admin har narsa qila oladi (rol asosida sidebar ko'rinishi bor xolos). | ~5h |
| **Browser cache** | uz.json o'zgarsa, `docker compose build --no-cache web` kerak (statik import). | Fix: `next-intl` server-side approach. ~4h |
| **PDF DejaVu shrift** | Container'da `DejaVu` o'rnatilgan deb taxmin qiladi. Yo'q bo'lsa Helvetica fallback (kirill buziladi). | Fix: Dockerfile'ga `fonts-dejavu-core` qo'shish |
| **Mobile responsive** | Sahifalar desktop-first. Telefonda jadvallar to'g'ri ko'rinmaydi. | ~10h (Tailwind responsive classes) |
| **POS sahifa** | `/pos/` sahifa yetilmagan — minimal interfeysi. Real kassir uchun barcode + scale + chek printer kerak. | ~12h |

---

## 🔴 PRIORITET 1 — Yaqin oylar (1-3 oy)

### 1.1. Mobil ilova
**Maqsad:** Foydalanuvchi telefondan to'liq tizimga kirishi
**Variantlar:**
- **A) PWA** (~6-10 soat) — mavjud Next.js'ni mobil-friendly qilish + offline + install prompt
- **B) Capacitor** (~10-15 soat) — PWA'ni `.apk` / `.ipa` ga o'rash
- **C) React Native** (~30-40 soat) — alohida native ilova
**Tavsiya:** A → B (etap-etap, eski kod ishlatiladi)
**Funksional ustuvorlik:**
1. POS (kassir tezkor sotuv)
2. Sotuv qabul qilish + chek chop etish
3. Mahsulot/qoldiq qarash
4. Mijoz qidirish + balans
5. Dashboard KPI

### 1.2. Telegram bot real integratsiya
**Hozir:** UI sozlama placeholder tayyor (`/settings/crm` — Telegram bot token maydoni)
**Kerak:**
- `aiogram 3.x` yoki `python-telegram-bot` integration
- Webhook endpoint (`POST /api/v1/integration/telegram/webhook`)
- Sotuv yaratilganda kanalga xabarnoma (avtomatik)
- Past qoldiq bo'lganda xabarnoma
- `/start` komandasi orqali xodim ro'yxatdan o'tishi
- Mijozlar uchun: chek raqami orqali sotuvni qidirish

### 1.3. PDF chek + hisob-faktura
**Hozir:** Browser print orqali (Ctrl+P)
**Kerak:**
- Backend PDF generation (`reportlab` yoki `weasyprint`)
- 58mm/80mm chek printerlari uchun ESC/POS
- A4 hisob-faktura — soliq invoice formati (O'zbekiston standartiga moslangan)
- QR-kod sotuv tasdiqi uchun
- Soliq inspektsiyasi `tax.uz` formati (kelajakda)

### 1.4. Excel real eksport (.xlsx)
**Hozir:** CSV bilan ; separator + UTF-8 BOM
**Kerak:**
- `openpyxl` orqali `.xlsx` generation
- Bir nechta varaq (sheets) — masalan "Sotuvlar | Mahsulotlar | Mijozlar"
- Formula va format (raqam, sana, valyuta)
- Logo + sarlavha
- Filter va sort tayyor holatda

---

## 🟡 PRIORITET 2 — O'rta muddat (3-6 oy)

### 2.1. Customer portal (mijoz tomon)
**Maqsad:** Mijoz o'z balansini, sotuv tarixini, qarzini ko'rishi
- Mijoz alohida login (telefon + OTP)
- Sotuvlar ro'yxati (faqat o'ziniki)
- Balans + qarz
- Buyurtma yuborish (online)
- Chek/hisob-faktura yuklash

### 2.2. AI assistent
**Maqsad:** Hisobotlar bo'yicha tabiiy tilda savol-javob
- Claude / OpenAI API
- Tezkor savollar: "Bu oy nima ko'p sotildi?", "Kim eng ko'p qarzdor?"
- Anomaliyalarni topish (kutilmagan past sotuv, qoldiq pasayishi)
- Hisobot natijasini sharhlash
- Kelajak prognoz (3 oyda kerakli mahsulot miqdori)

### 2.3. Real qurilma integratsiyasi
**Hozir:** Settings UI tayyor (printer, skaner, tarozi modellari)
**Kerak:**
- WebUSB / WebSerial API orqali browserdan to'g'ridan-to'g'ri
- Yoki agent dasturi (Python/Electron) — barcode scanner, scale data
- Chek printeri ESC/POS protokoli
- Yorliq printeri (Zebra, TSC)
- Elektron tarozi (CAS, Mertech)

### 2.4. Onlayn to'lovlar real integratsiya
**Hozir:** Settings tayyor (Click, Payme, Apelsin Merchant ID maydonlari)
**Kerak:**
- Click Merchant API webhook + qaytarish URL
- Payme Receipts API
- Apelsin Cabinet integration
- QR-kod orqali to'lash (sotuv chekida QR)
- Avtomatik balans tasdiqlash

### 2.5. Audit log UI
**Hozir:** `audit_log` jadval mavjud, lekin ko'rinmaydi
**Kerak:**
- Audit middleware (har bir o'zgartirishni log qilish)
- UI: kim, qachon, qaysi yozuvni o'zgartirgan
- Versiya solishtirish (before/after diff)
- Foydalanuvchi sessiya tarixi

### 2.6. RBAC enforcement
**Hozir:** Roles jadvali bor, lekin majbur emas
**Kerak:**
- FastAPI dependency `require_permission()` har endpointda
- Frontend: ruxsatga qarab menu / tugma yashirish
- Standart rollar: Direktor, Buxgalter, Kassir, Sotuvchi, Ombor xodimi
- Custom rol yaratish UI

---

## 🟢 PRIORITET 3 — Uzoq muddat (6-12 oy)

### 3.1. SaaS multi-tenant SaaS rejim
**Maqsad:** Aniq ERP'ni boshqa kompaniyalar ham sotib olishi
- Tashkilotlar uchun avto-provisioning (yangi org → yangi DB schema)
- Tarif rejasi (Bepul, Start, Pro, Enterprise) — backend enforcement
- Click/Payme orqali oylik to'lov
- Foydalanuvchi sonini cheklash (tarif bo'yicha)
- Trial muddatlari
- Admin panel (aniq-erp tomonidan) — barcha mijozlarni ko'rish

### 3.2. Marketing avtomatlashtirish
- SMS marketing kampaniyalari (segmentlash bo'yicha)
- Tug'ilgan kun avtomatik chegirma
- Sodiqlik dasturi (keshbek hisoblash)
- Email marketing
- Push notification (mobil ilovaga)

### 3.3. Soliq integratsiya
- `soliq.uz` API integratsiya (avtomatik soliq hisobi)
- QQS hisoboti (avtomatik to'ldirish)
- Soliq deklaratsiyasi yaratish
- E-invoice (elektron hisob-faktura) — `tax.uz`

### 3.4. Bank integratsiya
- Asosiy banklar API (Asaka, Ipoteka, Hamkor, Davr, Kapital)
- Avtomatik bank ko'chirma import
- To'lov topshiriqlari avtomatik tasdiq
- Valyuta kursi avto-yangilash

### 3.5. Yetkazib berish xizmatlari
- Yandex Delivery integration
- Express24
- BTS Express
- Avtomatik narx hisoblash
- Kuzatuv link mijozga

---

## 🔵 PRIORITET 4 — Texnik qarz (har vaqt)

### 4.1. Database
- [ ] **Alembic migrations** — hozir `init.sql` + `schema_patches.py`
- [ ] **SQLAlchemy ORM modellar** — hozir raw SQL `text()`
- [ ] DB indeks audit (slow query analizi)
- [ ] Connection pool tuning
- [ ] Read replica (yuqori yuk uchun)

### 4.2. Testing
- [ ] **Pytest** — backend unit + integration testlar
- [ ] **Playwright** — frontend E2E (login, sale create, report view)
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Test coverage > 70%

### 4.3. DevOps
- [ ] Production Docker compose (resource limits, restart policy)
- [ ] Backup avtomatik (PostgreSQL pg_dump kunlik → S3)
- [ ] Monitoring (Prometheus + Grafana)
- [ ] Error tracking (Sentry)
- [ ] Log aggregation (Loki yoki ELK)
- [ ] Reverse proxy (Nginx/Caddy) + SSL (Let's Encrypt)
- [ ] CDN frontend assets uchun

### 4.4. Performance
- [ ] Server-side caching (Redis)
- [ ] Image optimization (Next.js Image + sharp)
- [ ] Lazy loading (admin sahifalar)
- [ ] DB query optimization (EXPLAIN ANALYZE)
- [ ] Pagination katta jadvallar uchun (hozir limit 50)

### 4.5. Security
- [ ] HTTPS majburiy (production)
- [ ] Rate limiting (DDoS himoyasi)
- [ ] 2FA (ikki bosqichli autentifikatsiya)
- [ ] Session timeout sozlash (hozir UI sozlama bor, backend enforcement kerak)
- [ ] SQL injection audit
- [ ] CORS to'g'ri sozlash
- [ ] Secrets management (HashiCorp Vault yoki Docker secrets)

### 4.6. Hujjat (Docs)
- [ ] API hujjati (OpenAPI/Swagger auto-generate)
- [ ] Foydalanuvchi qo'llanmasi (UZ/RU/EN videolar bilan)
- [ ] Developer guide (kelajakdagi mualliflar uchun)
- [ ] Architecture decision records (ADR)

---

## 📊 Hozir nima bor (v0.9 status)

### ✅ Tugallangan asosiy modullar
- **Auth** — login, register, JWT, refresh, multi-org
- **Organizations** — multi-tenant, org switcher
- **Finance** — kassa, transaksiya, hisob-faktura, valyuta, balans, oborot hisobotlari
- **Warehouse** — mahsulot, kategoriya, ombor, kirim, chiqim, inventarizatsiya, hisobdan chiqarish, perevod
- **Sale** — sotuv, qaytarish, mijoz to'lovlari, kontrakt, dashboard
- **Customer** — mijoz, kategoriya, segmentatsiya
- **Supplier** — yetkazib beruvchi
- **Manufacturing** — BOM, ishlab chiqarish buyurtmalari
- **HR** — xodim, lavozim, KPI
- **Marketing** — chegirma, kutilayotgan mahsulot
- **Reference** — birlik, joylashuv, yur/jis shaxs, narxnoma
- **Tools** — eksport markazi (CSV), narx massasiy o'zgartirish
- **Settings** — 30+ sozlama sahifa
- **Integration** — overview + 7 integratsiya placeholder

### ✅ Tugallangan texnik xususiyatlar
- **i18n** 100% (UZ/RU/EN) — 1131 kalit, 153 sahifa
- **Dark/Light theme** — next-themes, default light
- **Multi-tenant** — X-Organization-Id header
- **DB** — 67 jadval, view'lar, multi-currency
- **Docker** — 5 servis (web, api, postgres, redis, pgadmin)
- **Seed** — Aniq Demo org (30 mahsulot, 50 mijoz, 5 sotuv)
- **CSV eksport** — Excel-friendly (UTF-8 BOM, `;` separator, UZ headers)

---

## 📌 Eslatma

Bu reja **dinamik** — yangi imkoniyatlar / mijoz so'rovlariga qarab o'zgaradi.
Har faza tugaganida bu fayl yangilanadi (✅ qo'shib qo'yiladi).

Yangi g'oya bo'lsa shu faylga `## 🟣 PRIORITET 5 — Tushunchalar` bo'limiga qo'shing.
