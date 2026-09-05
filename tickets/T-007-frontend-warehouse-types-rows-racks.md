# T-007 — Frontend: Warehouse Types Page + Rows/Racks Detail Pages

## Goal
Build the warehouse types CRUD page and the warehouse detail pages for managing rows and racks inside a warehouse.

## Owner Role
`frontend-dev`

## Depends On
`T-004` (backend endpoints must exist), `T-003` (corrupted file deleted)

## Estimated Size
M

## Files Likely Touched
- `apps/web/app/(dashboard)/warehouse/types/page.tsx` — rebuild (replace current working but likely thin page)
- `apps/web/app/(dashboard)/warehouse/[wid]/rows/page.tsx` — new file
- `apps/web/app/(dashboard)/warehouse/[wid]/rows/[rid]/racks/page.tsx` — new file
- `apps/web/app/(dashboard)/warehouse/warehouses/page.tsx` — add `type_id` selector to create/edit modal
- `apps/web/lib/menu.config.ts` — verify warehouse types entry has `permission: "warehouse.type.view"`
- `apps/web/i18n/messages/uz.json`, `ru.json`, `en.json`, `uz-cyrl.json` — add keys for new strings

## UI Specifications

### `/warehouse/types`
- Table columns: Name, Code, Status (Active/Inactive), Actions (Edit, Deactivate).
- "Yangi tur" button opens Modal with fields: name (required), code (select: central/pos/transit/scrap/custom).
- Edit opens same modal pre-filled.
- Deactivate uses ConfirmDialog (not window.confirm).
- Permission guard: write actions hidden for viewer role.

### `/warehouse/[wid]/rows`
- Page header: Warehouse name + breadcrumb (Warehouses → {name} → Rows).
- Table columns: Row Name, Rack Count, Sort Order, Actions.
- "Yangi qator" button opens Modal: name (required), sort_order (number, default 0).
- Click row name → navigates to `/warehouse/{wid}/rows/{rid}/racks`.
- Delete row: ConfirmDialog; if API returns 409 → toast.error("Bu qatorda stellajlar bor, avval o'chiring").

### `/warehouse/[wid]/rows/[rid]/racks`
- Page header breadcrumb: Warehouses → {wh name} → Rows → {row name} → Racks.
- Table columns: Rack Name, Sort Order, Actions.
- "Yangi stellaj" button opens Modal: name (required), sort_order.
- Delete rack: ConfirmDialog; if API returns 409 → toast.error("Bu stellajga mahsulot bog'langan").

### Warehouse create/edit modal enhancement
- Add `type_id` dropdown (fetched from `GET /warehouse/types`).
- Label: "Ombor turi", optional field.

## Acceptance Criteria
- [ ] Types page renders at 375px (mobile cards pattern), 768px, 1280px without horizontal overflow.
- [ ] Creating a type reflects immediately in the list without page reload.
- [ ] Rows page: clicking a row navigates to racks sub-page.
- [ ] Breadcrumb is correct on all three levels.
- [ ] Warehouse create modal includes type selector; selected type_id sent to API.
- [ ] All user-visible strings are in i18n files (no hardcoded Uzbek/Russian text in TSX).
- [ ] `permission` field set on all new menu entries (if any added to menu.config.ts).
- [ ] No `window.confirm()` used anywhere.
- [ ] No hardcoded `grid-cols-N` without responsive prefix.

## How We'll Know It's Done
At 375px: warehouse types list shows as cards. At 1280px: shows as table. Create row → rack → product assigned to rack; all breadcrumbs correct.
