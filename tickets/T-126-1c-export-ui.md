# T-126: Frontend — 1C export sahifasi

**Wave:** 4C
**Owner:** frontend-dev
**Size:** S
**Depends on:** T-105

## Goal
`app/(dashboard)/settings/1c-export/page.tsx` — sana filter, tur tanlash, format, download tugma.

## Files likely touched
- `apps/web/app/(dashboard)/settings/1c-export/page.tsx` (yangi)
- `apps/web/lib/menu.config.ts` (`finance.export` permission)
- `apps/web/i18n/messages/*.json`

## UI tarkibi
- Sana oralig'i: `date_from` — `date_to` (date picker)
- Tur: Sales / Cash / Counterparties / All (select yoki checkbox group)
- Format: CSV / XML (radio)
- "Yuklab olish" tugmasi → `GET /finance/export/1c-csv?...` → browser download

## Acceptance criteria
- Download: `api.get(..., {responseType: 'blob'})` → `URL.createObjectURL` → `<a>` click.
- Sana oralig'i 366 kundan oshsa frontend validatsiya xato ko'rsatadi.
- Loading state "Yuklab olish" tugmada.
- `finance.export` permission — accountant va admin ko'radi.
- Responsive.

## How we'll know it's done
"Yuklab olish" bosganda CSV file brauzer tomonidan yuklab olinadi; XML formatda ham ishlaydi.
