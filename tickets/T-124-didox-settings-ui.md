# T-124: Frontend — Didox settings sahifasi

**Wave:** 4C
**Owner:** frontend-dev
**Size:** S
**Depends on:** T-120

## Goal
`app/(dashboard)/settings/didox/page.tsx` — STIR, token, sandbox toggle, test ulanish, invoice send preview.

## Files likely touched
- `apps/web/app/(dashboard)/settings/didox/page.tsx` (yangi)
- `apps/web/lib/menu.config.ts` (settings bo'limiga Didox qo'shish, `integration.manage` permission)
- `apps/web/i18n/messages/*.json`

## UI tarkibi
- STIR raqami (text input, 9 ta raqam validation)
- API token (password input)
- Sandbox mode toggle
- "Test ulanish" tugmasi
- "E-faktura yuborish" — sale dropdown + "Yuborish" tugma (stub, T-120 backend)
- Status badge: Connected / Not configured / Error

## Acceptance criteria
- Barcha mavjud settings page pattern'iga mos (`api.post/get`, toast, getErrorMessage).
- `ConfirmDialog` — settings o'zgartirilmagan holda navigatsiya.
- 375/768/1280 responsive.
- `menu.config.ts`'da `integration.manage` permission bilan.
- "E-faktura yuborish" formasida MXIK kod yo'q bo'lsa warning badge ko'rinadi.

## How we'll know it's done
Sahifa yuklanadi; bo'sh credentials bilan "Test ulanish" bosganda `"credentials_missing"` toast chiqadi; sidebar'da Didox ko'rinadi (permission bo'lsa).
