# T-130: Frontend — Integration hub sahifasi

**Wave:** 4D
**Owner:** frontend-dev
**Size:** M
**Depends on:** T-115, T-124, T-125, T-126, T-127

## Goal
`app/(dashboard)/integrations/page.tsx` — barcha integratsiyalar dashboard'i: status kartochkalar, enable/disable, tez navigatsiya.

## Files likely touched
- `apps/web/app/(dashboard)/integrations/page.tsx` (yangi yoki to'liq qayta yozish)
- `apps/web/lib/menu.config.ts` (top-level "Integratsiyalar" menu item, `integration.manage`)
- `apps/web/i18n/messages/*.json`

## Data source
`GET /integrations/status` — barcha registered provider'lar va `{provider, enabled, configured, last_test_at, last_test_ok}`.

## UI tarkibi
Grid kartochkalar (2 ustun mobile, 3-4 ustun desktop):

Har kartochka:
- Provider logo/icon (lucide yoki custom SVG)
- Nomi
- Status badge: `Faol` (emerald) / `Sozlanmagan` (zinc) / `Xato` (rose)
- Enable/disable toggle
- "Sozlamalar" tugmasi — tegishli settings sahifaga o'tish

Kategoriyalar: To'lovlar | Yetkazib berish | Hujjatlar | Aloqa | Eksport

## Acceptance criteria
- `GET /integrations/status` loading state bilan.
- Enable/disable toggle — `POST /integrations/{provider}/settings {enabled: bool}`.
- Har kartochka `href` orqali settings sahifasiga o'tadi.
- Responsive: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`.
- `integration.manage` permission — faqat admin/manager ko'radi.
- Soliq integratsiyasi ko'rsatilmaydi (out of scope).

## How we'll know it's done
Hub sahifasi `GET /integrations/status` dan barcha provider'larni oladi; toggle bosib Alif'ni enable qilganda kartochka status o'zgaradi.
