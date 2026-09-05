# T-125: Frontend — Delivery settings sahifasi (Yandex + BTS)

**Wave:** 4C
**Owner:** frontend-dev
**Size:** S
**Depends on:** T-121, T-122

## Goal
`app/(dashboard)/settings/delivery/page.tsx` — Yandex Delivery va BTS Delivery ikkalasi bir sahifada.

## Files likely touched
- `apps/web/app/(dashboard)/settings/delivery/page.tsx` (yangi)
- `apps/web/lib/menu.config.ts` (`integration.manage`)
- `apps/web/i18n/messages/*.json`

## UI tarkibi
Ikki accordion/tab: **Yandex Delivery** | **BTS Delivery**

Har biri:
- Enable toggle
- Credentials fields (provider'ga mos)
- Sandbox checkbox
- "Test ulanish" tugmasi
- Narx hisoblash: "Test estimate" (manzil + vazn → stub narx)

## Acceptance criteria
- T-124 bilan bir xil pattern (toast, getErrorMessage, ConfirmDialog, responsive).
- `integration.manage` permission.

## How we'll know it's done
Sahifa yuklanadi; har provider uchun alohida "Test ulanish" ishlaydi.
