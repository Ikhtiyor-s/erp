# T-115: Frontend — Payment settings UI kengaytirish

**Wave:** 4B
**Owner:** frontend-dev
**Size:** M
**Depends on:** T-110, T-111, T-112, T-113

## Goal
`settings/online-payments/page.tsx` — 4 yangi provayder (Alif, Uzum, Multicard, Rahmat) uchun toggle + config form + "Test ulanish" tugma.

## Files likely touched
- `apps/web/app/(dashboard)/settings/online-payments/page.tsx` (kengaytirish)
- `apps/web/i18n/messages/uz.json` + ru.json + en.json + uz-cyrl.json + kaa.json

## UI pattern
Mavjud `SettingsForm` component o'rniga tab yoki accordion pattern (Click, Payme, Alif, Uzum, Multicard, Rahmat — 6 ta provider).

Har provider uchun:
- Enable/disable toggle
- Credentials fields (password type'da — masked)
- Sandbox mode checkbox
- "Test ulanish" tugmasi → `POST /integrations/{provider}/test-connection` → toast success/error

## Acceptance criteria
- 6 ta provayder bir sahifada (Click + Payme mavjud + 4 yangi).
- Har provayder collapse/expand accordion yoki tab bilan.
- "Test ulanish" disabled bo'lsa credentials bo'sh bo'lganda.
- `getErrorMessage(e, "Ulanish xatosi")` ishlatiladi.
- `ConfirmDialog` — agar settings o'zgartirilmagan holda boshqa tabga o'tsa (ixtiyoriy).
- Responsive: 375/768/1280 ko'rinadi.
- Yangi providers "coming soon" badge bilan (credentials yo'q bo'lganda) — lekin forma ishlaydi.
- `menu.config.ts`'da `integration.manage` permission.

## How we'll know it's done
Alif toggle enable qilib, bo'sh credentials bilan "Test ulanish" bosganda `"credentials_missing"` xato toast chiqadi; Click/Payme ishlashi o'zgarmaydi.
