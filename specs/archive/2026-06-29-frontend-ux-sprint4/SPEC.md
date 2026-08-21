# SPEC — Frontend UX HIGH paketi: responsive grid, mobile cards, error handling, accessibility / Sprint #4 (2026-06-29)

> PM tomonidan yoziladi. Bu **PROPOSE** bosqichi.
> Format: `.claude/skills/openspec-format.md` ga qarang.

## Niyat

Frontend UX auditi Aniq ERP dashboard, mobile PWA va customer portal'da production'ga chiqarishdan
oldin hal qilinishi shart bo'lgan 10 ta HIGH topilmani aniqladi. Asosiy muammo: ~50 ta sahifa
telefon (375px) da to'liq buzilgan — hardcoded `grid-cols-4/5/6` `sm:` prefix'siz ekranga sig'maydi;
90+ jadval sahifasida mobile card pattern yo'q — foydalanuvchi mobil qurilmadan jadval satrlarini
o'qiy olmaydi; 70+ fayl `e?.response?.data?.detail` antipattern'i ishlatadi — xato xabarlari
noto'g'ri locale'da ko'rinadi; POS tugmalari Apple HIG/WCAG 44×44px minimum'dan kichik;
customer portal submitOrder'da timeout yo'q — tarmoq uzilsa foydalanuvchi qolib ketadi; portal va
mobile modallar focus trap'siz (klaviatura foydalanuvchisi chiqib keta olmaydi); Field component
`htmlFor` bog'liqsiz (sichqonchaz foydalanuvchi label bosganda input'ga focus ketmaydi); Android
keyboard ochilganda POS ekrani `calc(100vh-105px)` tufayli buziladi; icon-only tugmalar
`aria-label`'siz — screen reader foydalanuvchilari uchun qurilma noaniq. Hamma muammo mavjud
patternlarni tatbiq etish orqali hal qilinadi — yangi komponent, yangi arxitektura, vizual redesign
kerak emas. Production onboardingdan oldin barcha HIGH topilmalar yopilishi shart.

## Tegishli foydalanuvchi

- `admin` — dashboard sahifalar, jadval ko'rinishlar, icon tugmalar
- `manager` — sotuv, ombor, mijozlar ro'yxatlari (mobil va desktop)
- `accountant` — moliya tranzaksiyalar ro'yxati
- `cashier` — POS interfeysi (touch targets, keyboard height)
- `viewer` — barcha ro'yxat sahifalar (read-only, mobil ham)
- Anonim mijoz (customer portal) — korzina, buyurtma modallar

## Acceptance criteria (Given/When/Then)

### S1: Responsive grid — telefonda o'qish mumkin (H-1)

**Scenario 1 (happy path): Admin users sahifasi 375px da ishlaydi**
- **Given** `admin` roli bilan kirgan, viewport 375px
- **When** `/admin/users` sahifasi ochiladi
- **Then** barcha grid elementlar `grid-cols-1` sifatida ko'rinadi (yon-yon yoki chiqib ketmaydi)
- **And** matn o'qish mumkin bo'ladi (overflow yo'q)

**Scenario 2 (negative): `grid-cols-4` `sm:` prefix'siz qolmaydi**
- **Given** T-1 bajarilgandan keyin
- **When** `grep -rn "grid-cols-[3-6]" apps/web/app/ | grep -v "sm:" | grep -v "md:" | grep -v "lg:"` bajariladi
- **Then** top 25 ta tekshirilgan sahifada natija bo'sh yoki faqat tuzatilmagan (Sprint #5 scope) sahifalar qoladi

**Scenario 3 (boundary): sm va lg breakpoint'da to'g'ri o'tadi**
- **Given** viewport 640px (sm) va 1280px (lg)
- **When** dashboard statistika kartalari ochiladi
- **Then** sm da `grid-cols-2`, lg da `grid-cols-4` ko'rinadi — rasm buzilmaydi

---

### S2: Mobile-card pattern — jadval mobil qurilmada o'qiladi (H-2)

**Scenario 1 (happy path): Roles sahifasi telefonda card ko'rinishida chiqadi**
- **Given** `admin` roli, viewport 375px
- **When** `/admin/roles` sahifasi ochiladi
- **Then** `<ul className="md:hidden">` bloki ko'rinadi — har rol alohida card sifatida
- **And** `<div className="hidden md:block">` desktop jadval ko'rinmaydi

**Scenario 2 (negative): Desktop da card yashiriladi, jadval ko'rinadi**
- **Given** viewport 1280px
- **When** `/admin/roles` sahifasi ochiladi
- **Then** `<div className="hidden md:block">` ko'rinadi, `<ul className="md:hidden">` ko'rinmaydi

**Scenario 3 (boundary): 768px (md breakpoint) da o'tish to'g'ri ishlaydi**
- **Given** viewport aylantirilib 767px va 769px o'lchovlarda sinab ko'riladi
- **When** sahifa ikki o'lchovda ochiladi
- **Then** 767px'da card, 769px'da jadval ko'rinadi — gap yo'q, layout buzilmaydi

---

### S3: Error handling — xato xabari to'g'ri locale'da ko'rinadi (H-4)

**Scenario 1 (happy path): `getErrorMessage` helper ishlatiladi**
- **Given** `sale/sales/page.tsx` da yangi sotuv yaratish formi
- **When** server 422 xato qaytaradi (`{ detail: "Yetarli miqdor yo'q" }`)
- **Then** toast `getErrorMessage(e, "Xato")` orqali `"Yetarli miqdor yo'q"` matnini ko'rsatadi

**Scenario 2 (negative): `e?.response?.data?.detail` antipattern qolmaydi**
- **Given** T-3 bajarilgandan keyin, top 20 ta tekshirilgan fayl
- **When** `grep -rn "e?\\.response\\?\\.data\\?\\.detail"` bajariladi
- **Then** o'zgartirilgan fayllarda bu pattern topilmaydi

**Scenario 3 (boundary): Server `detail` yo'q bo'lganda fallback ko'rinadi**
- **Given** server 500 xato, `detail` field yo'q yoki `undefined`
- **When** xato ushlanadi
- **Then** `getErrorMessage(e, "Xato yuz berdi")` fallback matnini ko'rsatadi — bo'sh toast yo'q

---

### S4: POS touch targets — 44px minimum (H-3)

**Scenario 1 (happy path): Barcode tugmasi barmoq bilan bosiladi**
- **Given** `cashier` roli, `m/pos` sahifasi, real iOS qurilma yoki DevTools 375px
- **When** barcode/scale tugmasi bosiladi
- **Then** tugma `min-h-[44px] min-w-[44px]` qoidasiga mos — bosilganda miss ehtimoli minimal

**Scenario 2 (negative): `h-8` (32px) kabi kichik tugmalar qolmaydi**
- **Given** T-4 bajarilgandan keyin
- **When** `m/pos/page.tsx` dagi interaktiv `<button>` elementlari ko'rib chiqiladi
- **Then** har biri `min-h-[44px]` yoki ekvivalent class'ga ega

**Scenario 3 (boundary): Android keyboard ochilganda POS layout buzilmaydi**
- **Given** Android qurilmada POS input'ga focus beriladi, virtual keyboard ochiladi
- **When** keyboard ochiladi
- **Then** layout `min-h-screen` yoki `dvh` unit bilan mos keladi — kontent kesilmaydi

---

### S5: Portal cart — timeout va focus trap (H-5, H-7, H-8)

**Scenario 1 (happy path): submitOrder 20s ichida muvaffaqiyatli**
- **Given** anonim mijoz cart'da, tarmoq normal
- **When** "Buyurtma berish" bosiladi
- **Then** 20s ichida javob keladi, toast.success ko'rinadi

**Scenario 2 (negative): submitOrder 20s o'tsa xato ko'rsatadi**
- **Given** anonim mijoz cart'da, server javob bermaydi (network drop simulatsiyasi)
- **When** 20s o'tadi
- **Then** `toast.error(getErrorMessage(e, "Buyurtma yuborishda xato"))` — foydalanuvchi qolib qolmaydi

**Scenario 3 (boundary): Portal modal'da Tab klavishasi focus'ni modal ichida ushlab turadi**
- **Given** portal/sales yoki portal/products sahifasida modal ochiq
- **When** Tab klavishasi bir necha marta bosiladi
- **Then** focus modal chegarasidan chiqmaydi — `<Modal>` komponenti focus trap ishlatadi

---

### S6: Icon-only tugmalar aria-label (H-10)

**Scenario 1 (happy path): O'chirish tugmasi screen reader'da aniq e'lon qilinadi**
- **Given** screen reader (NVDA/VoiceOver) yoqilgan
- **When** `<button aria-label="O'chirish"><Trash /></button>` ga focus keladi
- **Then** screen reader "O'chirish" deb o'qiydi — faqat "button" emas

**Scenario 2 (negative): `aria-label`'siz icon-only tugmalar qolmaydi**
- **Given** T-6 bajarilgandan keyin, top 20 ta tekshirilgan tugma
- **When** `aria-label` mavjudligi tekshiriladi
- **Then** har icon-only tugmada `aria-label` atributi mavjud

**Scenario 3 (boundary): Matnli tugmada `aria-label` talab qilinmaydi**
- **Given** `<button>Saqlash</button>` — matn bor
- **When** screen reader o'qiydi
- **Then** "Saqlash" matn o'qiladi — qo'shimcha `aria-label` kerak emas (mavjud matn yetarli)

---

## Talablar (RFC 2119)

### T-1: Responsive grid (H-1)

- **MUST**: Top 25 ta dashboard sahifadagi barcha `grid-cols-3`, `grid-cols-4`, `grid-cols-5`, `grid-cols-6` class'lari `sm:` yoki `md:` prefix'li ekvivalent bilan almashtirilishi shart.
- **MUST**: Pattern: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-N` (N — asl qiymat). Kichik N (3 dan kichik) uchun `grid-cols-1 sm:grid-cols-N` yetarli.
- **MUST NOT**: Hech bir o'zgartirilgan faylda `sm:` yoki `md:` yoki `lg:` prefix'siz `grid-cols-3+` qolmasligi shart.
- **SHOULD**: Grep bilan top 25 ta faylni yakka-yakka tekshirish, keyin umumiy grep bilan tasdiqlash.
- **MAY**: Sprint #5 uchun qolgan sahifalar izohga olinishi mumkin — lekin tasdiqlangan ro'yxat sifatida.

### T-2: Mobile-card pattern (H-2)

- **MUST**: 10 ta belgilangan sahifaning har birida `<div className="hidden md:block">` (desktop table) va `<ul className="md:hidden">` (mobile cards) pattern bo'lishi shart.
- **MUST**: Har mobile card'da minimal ma'lumot: sarlavha (birinchi ustun), ikkinchi muhim ustun, amallar tugmalar.
- **MUST NOT**: Mobile card'da o'ng tomonga overflow qiluvchi keng matn bloklari qolmasligi shart.
- **SHOULD**: Mavjud `admin/users/page.tsx` pattern'i ko'chirish template sifatida ishlatilsin.
- **MAY**: Card'da ko'rsatilgan ustunlar soni desktop jadval ustunlaridan kam bo'lishi mumkin — faqat eng muhimlari.

### T-3: Error handling (H-4)

- **MUST**: Top 20 ta faydagi har `e?.response?.data?.detail` (yoki `err?.response?.data?.detail`) pattern `getErrorMessage(e, "fallback")` bilan almashtirilishi shart.
- **MUST**: Har o'zgartirilgan faylda `import { getErrorMessage } from "@/lib/api-error"` import mavjud bo'lishi shart — agar avval yo'q bo'lsa.
- **MUST NOT**: `|| "Xato"` yoki `|| "Error"` kabi string concatenation fallback'lar qolmasligi shart (getErrorMessage'da fallback parametr bor).
- **SHOULD**: Import avval mavjud bo'lsa dublikat qo'shilmasin.

### T-4: POS va mobile UX (H-3, H-6, H-9)

- **MUST**: `m/pos/page.tsx` dagi barcha interaktiv `<button>` elementlari `min-h-[44px] min-w-[44px]` yoki undan katta bo'lishi shart.
- **MUST**: `m/pos/page.tsx` dagi `h-[calc(100vh-105px)]` `min-h-screen` yoki `min-h-dvh` bilan almashtirilishi shart.
- **MUST**: `m/customers`, `m/hr`, `m/warehouse`, `m/finance` sahifalarida API chaqiruvlari `try/catch` bilan o'ralishi va `toast.error(getErrorMessage(e, "Xato"))` ko'rsatilishi shart.
- **MUST NOT**: `window.alert()` yoki hech qanday error handling yo'q holati qolmasligi shart.

### T-5: Portal modallar + Field label (H-5, H-7, H-8)

- **MUST**: `components/ui/modal.tsx` da `Field` component `id` prop qabul qilishi va `<label htmlFor={id}>` + `<input id={id}>` bog'liqligi bo'lishi shart.
- **MUST**: `portal/sales/page.tsx` va `portal/products/page.tsx` modallari `<Modal>` komponentidan (focus trap built-in) foydalanishi shart.
- **MUST**: `portal/cart/page.tsx` da `submitOrder` so'rovida 20 soniya timeout va bitta retry (yoki `AbortController` bilan 20s) bo'lishi shart.
- **MUST**: Timeout yoki xato bo'lsa `toast.error(getErrorMessage(e, "Buyurtma yuborishda xato"))` ko'rsatilishi shart.
- **MUST NOT**: `window.confirm()` ishlatilmasligi shart — `<ConfirmDialog>` ishlatilsin.

### T-6: Icon-only aria-label (H-10)

- **MUST**: Top 20 ta icon-only `<button>` (matn yo'q, faqat icon) `aria-label` atributiga ega bo'lishi shart.
- **MUST**: `aria-label` qiymati O'zbek tilida (`"O'chirish"`, `"Tahrirlash"`, `"Ko'rish"`, `"Yopish"` va h.k.) bo'lishi shart.
- **SHOULD**: Matn bor tugmalarga `aria-label` qo'shilmasligi kerak — keraksiz verbosity.
- **MAY**: Ikonka-only tugmalarda `aria-hidden="true"` ikonkaga qo'shilishi mumkin (screen reader ikonkani skip qiladi, `aria-label` o'qiladi).

---

## QILMAYMIZ (qamrov-tashqarisida)

- Visual redesign — mavjud dizayn o'zgarmaydi, faqat existing patternlar tatbiq qilinadi
- Yangi UI komponent yaratish — faqat mavjud `Modal`, `Field`, `getErrorMessage`, `ConfirmDialog` ishlatiladi
- Backend o'zgartirish — bu sprint faqat frontend
- i18n yangi til qo'shish yoki tarjima yangilash — alohida sprint
- Performance optimizatsiya (lazy load, code split, React.memo) — alohida sprint
- E2E Playwright test suite kengaytirish — alohida sprint
- Sprint #5 uchun qolgan 25+ sahifa responsive fix — keyingi sprint
- Sprint #5 uchun qolgan 80+ jadval sahifa mobile card — keyingi sprint
- Sprint #5 uchun qolgan 50+ fayl error handling — keyingi sprint
- WCAG AA to'liq compliance audit — alohida audit sprint
- RTL (right-to-left) support — Aniq ERP O'zbekiston bozori uchun (LTR yetarli)
- Server-side rendering optimizatsiya — alohida arxitektura sprint

---

## Rollback rejasi

- **Barcha o'zgarishlar**: Git revert — oddiy Tailwind class o'zgartirish va import qo'shish. DB o'zgarishi yo'q.
- **T-5 Field component**: `htmlFor` prop backward-compatible — eski `Field` ishlatmalarda `id` berilmasa label bog'liqsiz qoladi (avvalgi holat, regression yo'q).
- **T-5 portal cart timeout**: `AbortController` yoki axios timeout — server javob berganda eski kabi ishlaydi. Faqat slow tarmoqda foydalanuvchi uchun yaxshilanadi.
- **TypeScript build**: Har ticket bajarilgandan keyin `docker compose build web` tekshirilishi shart. Xato bo'lsa — revert.
- **User-facing**: Hech bir o'zgarish yangi sahifa, yangi route yoki yangi API endpointni talab qilmaydi — faqat mavjud UI'ni yaxshilash.

---

## Tegishli modullar

### Frontend (o'zgartiriladigan fayllar)

**T-1 (responsive grid — top 25 sahifa):**
- `apps/web/app/(dashboard)/admin/users/page.tsx`
- `apps/web/app/(dashboard)/admin/roles/page.tsx`
- `apps/web/app/(dashboard)/sale/sales/page.tsx`
- `apps/web/app/(dashboard)/sale/customer-payments/page.tsx`
- `apps/web/app/(dashboard)/warehouse/products/page.tsx`
- `apps/web/app/(dashboard)/warehouse/categories/page.tsx`
- `apps/web/app/(dashboard)/warehouse/warehouses/page.tsx`
- `apps/web/app/(dashboard)/customer/list/page.tsx`
- `apps/web/app/(dashboard)/finance/transactions/page.tsx`
- `apps/web/app/(dashboard)/supplier/list/page.tsx`
- `apps/web/app/(dashboard)/admin/audit-log/page.tsx`
- `apps/web/app/(dashboard)/settings/subscription/page.tsx`
- Va grep orqali topilgan qolgan 13+ sahifa

**T-2 (mobile card — 10 sahifa):**
- `apps/web/app/(dashboard)/admin/roles/page.tsx`
- `apps/web/app/(dashboard)/sale/sales/page.tsx`
- `apps/web/app/(dashboard)/warehouse/products/page.tsx`
- `apps/web/app/(dashboard)/customer/list/page.tsx`
- `apps/web/app/(dashboard)/finance/transactions/page.tsx`
- `apps/web/app/(dashboard)/warehouse/categories/page.tsx`
- `apps/web/app/(dashboard)/supplier/list/page.tsx`
- `apps/web/app/(dashboard)/sale/customer-payments/page.tsx`
- `apps/web/app/(dashboard)/warehouse/warehouses/page.tsx`
- `apps/web/app/(dashboard)/admin/audit-log/page.tsx`

**T-3 (error handling — top 20 fayl):**
- Grep bilan aniqlanadi: `grep -rn "e?\\.response\\?\\.data\\?\\.detail" apps/web/app/`
- Asosiy: `sale/`, `admin/`, `warehouse/`, `finance/`, `customer/` sahifalari

**T-4 (POS + mobile):**
- `apps/web/app/m/pos/page.tsx`
- `apps/web/app/m/customers/page.tsx`
- `apps/web/app/m/hr/page.tsx`
- `apps/web/app/m/warehouse/page.tsx`
- `apps/web/app/m/finance/page.tsx`

**T-5 (portal + Field):**
- `apps/web/components/ui/modal.tsx`
- `apps/web/app/(portal)/portal/sales/page.tsx`
- `apps/web/app/(portal)/portal/products/page.tsx`
- `apps/web/app/(portal)/portal/cart/page.tsx`

**T-6 (aria-label — top 20 tugma):**
- Grep bilan aniqlanadi: `grep -rn "<button" apps/web/app/ apps/web/components/`
- Asosiy: CRUD jadval amallar tugmalari (Trash, Edit, Eye ikonkalar)

### Tegmaydi

- `apps/api/` — TEGMAYDI (faqat frontend sprint)
- `infra/postgres/init.sql` — TEGMAYDI
- `apps/web/lib/menu.config.ts` — TEGMAYDI (yangi sahifa yo'q)
- `apps/api/app/db/schema_patches.py` — TEGMAYDI
- Alembic migration fayllar — TEGMAYDI

---

## O'zbek bozori xosligi

- **OFD**: tegmaydi — bu sprint frontend UX
- **MXIK**: tegmaydi
- **QQS (NDS)**: tegmaydi
- **TIN/STIR**: tegmaydi
- **SMS (Eskiz.uz)**: tegmaydi
- **To'lov (Click/Payme)**: bilvosita — portal cart timeout (T-5) to'lov oqimini yaxshilaydi. Foydalanuvchi 20s kutgandan keyin xato ko'radi va qayta urinishi mumkin. Real to'lov gateway chaqiruvi backend tomonidan — tegmaydi.
- **Mobile foydalanuvchi**: O'zbekistonda smartphone asosiy qurilma. H-2 (mobile card) va H-3 (touch targets) to'g'ridan-to'g'ri O'zbek SMB foydalanuvchi tajribasini yaxshilaydi.
- **Accessibility**: Screen reader foydalanuvchilar (H-10 aria-label, H-8 htmlFor) — mahalliy bozor uchun kam prioritet, lekin WCAG minimal compliance production uchun shart.

---

## Effort estimation

| Ticket | Mavzu | Owner | Effort |
|---|---|---|---|
| T-1 | Responsive grid — top 25 sahifa | `frontend-dev` | M (1.5 soat) |
| T-2 | Mobile-card pattern — 10 jadval sahifa | `frontend-dev` | M (1.5 soat) |
| T-3 | Error handling — top 20 fayl `getErrorMessage` | `frontend-dev` | S (1 soat) |
| T-4 | POS + 4 mobile sahifa UX fix | `frontend-dev` | S (30 daqiqa) |
| T-5 | Portal modallar + Field htmlFor + cart timeout | `frontend-dev` | S (30 daqiqa) |
| T-6 | Icon-only buttons aria-label | `frontend-dev` | S (30 daqiqa) |
| **Jami** | | | **M (~5.5 soat)** |

## Tickets

- `tickets/T-1-responsive-grid-fix.md`
- `tickets/T-2-mobile-card-pattern.md`
- `tickets/T-3-error-handling-migration.md`
- `tickets/T-4-pos-mobile-ux.md`
- `tickets/T-5-portal-modal-field-fix.md`
- `tickets/T-6-aria-label-icon-buttons.md`
