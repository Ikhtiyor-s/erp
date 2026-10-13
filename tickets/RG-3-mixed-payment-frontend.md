# RG-3 — Frontend: aralash to'lov UI (desktop + mobil POS checkout)

**Spec**: `tickets/SPEC-regos-gap.md`

> ⚠️ **SUPERSEDED (2026-10-13)** — bu ticketda yozilgan "ikki input + bitta tasdiqlash" dizayni
> QURILMADI. Implementatsiya davomida REGOS-parity'ga yaqinroq "bosqichma-bosqich, bitta tugma =
> bitta to'lov" modeli tanlandi — qarang `tickets/RG-7-incremental-payment-panel.md`. Quyidagi
> matn faqat tarixiy referens uchun saqlanadi.

## Goal

POS checkout ekranida kassir bitta sotuvni ikki (yoki undan ko'p) to'lov usuliga bo'lib
kiritishi (masalan 50 000 so'm naqd + qolgani karta) — RG-2'da qurilgan backend endpoint orqali.

## Files likely touched

- `apps/web/app/(dashboard)/pos/page.tsx` — checkout modalida "Bitta usul" / "Bo'lib to'lash"
  toggle; bo'lib to'lashda har bir qator uchun usul+summa input, jami = savat summasiga teng
  bo'lishi kerak (frontend validatsiya, lekin backend ham tekshiradi — RG-2)
- `apps/web/app/m/pos/page.tsx` — xuddi shu, mobil formatda (hozirgi `checkout(paymentMethod)`
  funksiyasi bitta usulni qabul qiladi, `payments` massivi allaqachon shaklda bor — 183-188
  qatorlar — faqat UI'da ikkinchi qator kiritish imkoniyati yo'q)
- `apps/web/lib/api.ts` (yoki tegishli hook) — RG-2'dagi yangi endpoint chaqiruvi

## How we'll know it's done

- Kassir savatga mahsulot qo'shib, "Bo'lib to'lash" tanlasa — ikki input ko'rinadi (naqd summa,
  karta summa), jami avtomatik hisoblanadi va savat summasiga teng bo'lmaguncha "Tasdiqlash"
  tugmasi disabled
- Tasdiqlangandan keyin bitta sotuv yaratiladi, ikkala to'lov qatori bilan (RG-2 endpoint orqali)
- Chekda ikkala to'lov usuli va summasi alohida ko'rsatiladi (mavjud receipt shabloniga qo'shimcha
  qator)
- Bitta-usul (oddiy) checkout oqimi o'zgarishsiz ishlayveradi — regressiyasiz

## Owner role

`frontend-dev`

## Depends on

`RG-2-mixed-payment-backend.md`
