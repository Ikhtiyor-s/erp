# T-107: Frontend — Karakalpak til tanlash UI

**Wave:** 4A
**Owner:** frontend-dev
**Size:** S
**Depends on:** T-106

## Goal
Login sahifasi va settings/general sahifasidagi til dropdown'iga "Qaraqalpaqsha" opsiyasini qo'shish.

## Files likely touched
- `apps/web/app/m/login/page.tsx` (til selector)
- `apps/web/app/(dashboard)/settings/general/page.tsx` (til setting)
- `apps/web/components/` — agar alohida LanguageSwitcher component bo'lsa

## Acceptance criteria
- Til ro'yxatida `Qaraqalpaqsha` ko'rinadi (boshqa 4 til bilan birga).
- Tanlaganda sahifa `/kaa/...` ga redirect bo'ladi.
- Tanlangan til `localStorage` yoki cookie'da saqlanadi (mavjud pattern'ga mos).
- 375px mobile'da til dropdown to'g'ri ko'rinadi.

## How we'll know it's done
Settings'dan `Qaraqalpaqsha` tanlab, sahifani yangilanganda URL `/kaa/` bo'ladi va UI Karakalpak matnda ko'rinadi.
