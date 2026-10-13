# REGOS POS parity — hujjatlar

> Manba: `docs.regos.uz/ru/regos-pos` (2026-10-12/13 da qayta-qayta o'qib chiqildi).
> Maqsad: REGOS'ning aniq kassir-ekrani ishlash tartibini hujjatlashtirish, har bir
> bo'lim uchun **Aniq ERP hozir nima qiladi** (bor / yo'q / qisman) deb belgilash,
> va shu asosda keyingi ticketlarni rejalashtirish.

Bu papka [[feedback_regos_workflow_parity]] (2026-10-13: POS dizayni REGOS'ga 1:1
yaqin bo'lishi kerak, funksionallik ham 1:1 — kerak bo'lsa o'z funksiyalarimiz
ustiga qo'shiladi) ko'rsatmasining ishchi hujjati.

## Qanday o'qiladi

Har bir fayl uch qismdan iborat:

1. **REGOS nima qiladi** — docs.regos.uz'dan olingan, qadam-baqadam, aniq mexanika.
2. **Aniq ERP holati** — kodga qarab tekshirilgan (`apps/web/app/(dashboard)/pos/page.tsx`,
   `apps/api/app/modules/sale/*`, va h.k.) haqiqiy holat: ✅ bor / ⚠️ qisman / ❌ yo'q.
3. **Keyingi qadam** — agar gap bo'lsa, mavjud ticket havolasi yoki "yangi ticket kerak"
   degan qisqa izoh (bu hujjat o'zi ticket emas — faqat xarita).

## Kassir ekrani — umumiy joylashuv (3 zona)

REGOS'ning kassir ekrani uchta zonaga bo'lingan:

1. **Hujjat-ma'lumot paneli** — hujjat turi/holati/raqami, oraliq jami,
   chegirma, to'lanishi kerak summa, tanlangan qator tafsiloti.
2. **Mijoz-kartasi paneli** — shtrix-kod, chegirma%, bonus balansi —
   **alohida panel**, savat ichiga joylashtirilgan emas.
3. **Mahsulotlar ro'yxati** (ustunlari sichqon o'ng tugmasi orqali
   moslashtiriladi — "Выбор колонок") + **yon panel**: raqamli
   klaviatura, To'lov tugmasi, "⚡ Tezkor mahsulotlar" guruhlangan
   taxta ("⭐ Sevimlilar" pastki-tab bilan), sotuv/qaytarish rejimi
   almashtirgichi, savat bo'sh bo'lmasa chiqishda ogohlantirish.

**Aniq ERP holati (2026-10-13):** `pos/page.tsx` qayta qurildi — mahsulot
jadvali (Kod/Nomi/Soni/Narx/Summa), tepada totals-satr (Jami/Chegirma/
To'langan/TO'LOVGA), o'ngda raqamli klaviatura + katta "To'lov (F8)"
tugmasi. ❌ "Tezkor mahsulotlar" guruhlangan taxta yo'q, ❌ "Sevimlilar"
yo'q, ❌ mijoz-kartasi alohida paneli yo'q (oddiy `<select>` bor, savat
tepasida).

## Bo'limlar

- [`operations/sales-registration/general-information.md`](operations/sales-registration/general-information.md) — hujjat holat-modeli, qator sторnosi
- [`operations/sales-registration/add-items.md`](operations/sales-registration/add-items.md) — mahsulot qo'shish usullari
- [`operations/sales-registration/payment-by-document.md`](operations/sales-registration/payment-by-document.md) — to'lov ekrani
- [`operations/sales-registration/refund.md`](operations/sales-registration/refund.md) — qaytarish rejimi
- [`operations/sessions.md`](operations/sessions.md) — smena ochish/yopish
- [`operations/xreport.md`](operations/xreport.md) — X-hisobot maydonlari
- [`operations/cash-journal.md`](operations/cash-journal.md) — kassa jurnali
- [`operations/hot-keys.md`](operations/hot-keys.md) — tezkor tugmalar to'liq ro'yxati
- [`operations/additional-functions.md`](operations/additional-functions.md) — chegirma, sotuvchi, kassa harakati, mijoz kartasi, buyurtma, tarozi

## Umumiy holat (2026-10-13)

| Bo'lim | Holat |
|---|---|
| Kassir ekrani umumiy ko'rinishi (jadval + klaviatura + totals) | ✅ REGOS-uslubida qayta qurildi |
| Hotkeylar (F3/F5/F8/F9/F12/Delete) | ✅ asosiy to'plam qo'shildi |
| Chegirma (butun chek, %/so'm) | ✅ qo'shildi |
| Savat-qator sторnosi (audit-trail, o'chirish emas) | ❌ hali oddiy o'chirish — lekin savat sotuvgacha faqat frontend-draft, haqiqiy audit-trail shart emas |
| To'lov qatori sторnosi | ✅ qurildi (2026-10-13) — `POST /pay/{movement_id}/void`, audit-trail bilan, production'da sinaldi |
| Chekni kutish rejimi (Отложить) | ✅ qurildi (2026-10-13) — faqat to'lov-bosqichi yarmi (Отложена оплата); tahrirlash-bosqichi (Отложен) Aniq ERP arxitekturasida mavjud emas, sababi general-information.md'da |
| Kassaga naqd kiritish/chiqarish (sotuvsiz) | ✅ qurildi (2026-10-13) — backend avvaldan bor edi (`POST /finance/movements`), POS ekraniga ulandi |
| Sotuvchi kodi (komissiya uchun) | ❌ yo'q |
| Tarozi nol/tara | ❌ yo'q (faqat uzluksiz o'qish bor) |
| Kod nomenklaturasi / F3 strukturaviy qidiruv / kategoriya bo'yicha tanlash | ❌ yo'q (oddiy inline qidiruv bor) |
| Belgilangan tovar (UZ markirovka) oqimi | ❌ yo'q |

## Ma'lum kuzatuv (2026-10-13, hali tasdiqlanmagan)

Brauzer orqali qo'lda sinashda bir necha marta `ensureSale()`ning
`POST /sale/sales` so'rovi **serverda muvaffaqiyatli bajarildi (201,
server loglarida tasdiqlangan)**, lekin **klient uni tarmoq xatosi deb
hisobladi** (`postIdempotent`ning retry mexanizmi ham ikkinchi marta xuddi
shunday "muvaffaqiyatli-lekin-klient-bilmaydi" holatga tushdi) —
natijada foydalanuvchiga xato ko'rsatildi, savat esa saqlanib qoldi,
ammo backend'da egasiz (`status=confirmed`, `paid=0`) sotuv qoldi. Bu shu
sessiyada ko'rilgan muhitga xos tarmoq beqarorligi bilan bog'liq
bo'lishi mumkin (Postgres VM vaqtincha yuklangan edi) — ammo
`tapPayment()`/`ensureSale()`ning o'zi "server muvaffaqiyatli bajardi,
lekin klient bilmayapti" holatidan qanday tiklanishi (hozir — umuman
tiklanmaydi, `saleId` hech qachon frontend state'ga tushmaydi) real
chidamlilik (resilience) savoli sifatida qayd etiladi, kelajakda chuqur
tekshirish uchun. Kod o'zgartirilmadi — hozircha faqat kuzatuv.
