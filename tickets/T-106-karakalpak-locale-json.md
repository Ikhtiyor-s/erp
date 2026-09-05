# T-106: i18n — Karakalpak locale JSON

**Wave:** 4A
**Owner:** frontend-dev
**Size:** S
**Depends on:** none

## Goal
`messages/kaa.json` yaratish va locale provider'ga qo'shish — uz.json asosida Karakalpak tarjima.

## Files likely touched
- `apps/web/i18n/messages/kaa.json` (yangi)
- `apps/web/i18n/request.ts` yoki `routing.ts` (locale list'ga `kaa` qo'shish)
- `apps/web/next.config.mjs` (agar locales array bo'lsa)
- `apps/web/middleware.ts` (locale detection)

## Acceptance criteria
- `kaa.json` — uz.json'ning barcha kalitlari mavjud (hech qaysi key missing emas).
- Tarjima: Karakalpak Lotin alifbosi (qoraqalpaqsha).
- `next-intl` routing `/kaa/...` URL pattern bilan ishlaydi.
- Build vaqtida TypeScript/next-intl type error yo'q.
- Fallback: agar kalit `kaa.json`'da topilmasa, `uz.json`'ga fallback (next-intl config).

## WON'T DO
- Professional tarjima tekshiruvi — JSON stub qiymatlar bilan boshlash joiz (masalan: uz.json qiymatlarini kaa prefix bilan).
- Cyrillic Karakalpak variant — faqat Lotin.

## How we'll know it's done
`/kaa` URL'da sahifa yuklanadi; browser language picker'da `kaa` tanlaganda sahifa Karakalpak matnlar bilan ko'rinadi.
