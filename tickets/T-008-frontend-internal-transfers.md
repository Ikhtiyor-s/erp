# T-008 — Frontend: Internal Transfers Page (Create, Send, Receive, Cancel)

## Goal
Rebuild the internal transfers page with full workflow UI: create draft, send, receive, cancel — matching the backend state machine from T-005.

## Owner Role
`frontend-dev`

## Depends On
`T-005` (backend endpoints), `T-003` (corrupted file deleted)

## Estimated Size
L

## Files Likely Touched
- `apps/web/app/(dashboard)/warehouse/internal-transfers/page.tsx` — full rebuild
- `apps/web/i18n/messages/{uz,ru,en,uz-cyrl}.json` — add transfer-related keys

## UI Specifications

### List View (`/warehouse/internal-transfers`)
- Filter bar: status tabs (Barchasi / Draft / Yuborilgan / Qabul qilingan / Bekor qilingan), from-warehouse dropdown, date range.
- Table (desktop, hidden on mobile) columns: Doc №, From Warehouse, To Warehouse, Item Count, Status badge, Created By, Actions.
- Mobile cards (visible below md): Doc №, From→To, Status, date, action button.
- Status badge colors: draft=zinc, sent=amber, received=emerald, cancelled=rose.
- "Yangi o'tkazma" button → opens CreateTransferModal (permission: `warehouse.transfer.send`).

### CreateTransferModal
- Fields: From Warehouse (required, select), To Warehouse (required, select, cannot equal from), Notes (textarea).
- Line items table: Product (searchable select), Qty (number), Unit (auto-filled from product). Add/remove rows.
- Submit creates draft. Success → close modal, refresh list, toast.success.

### Row Actions (context-sensitive)
- **Draft**: "Yuborish" (send) button — ConfirmDialog "Mahsulotlar ombordan chiqariladimi?"; "Bekor qilish" (cancel).
- **Sent**: "Qabul qilish" (receive) button — ConfirmDialog "Mahsulotlar qabul omboriga kiritiladimi?"; Cancel only for admin (permission check `warehouse.transfer.cancel`).
- **Received / Cancelled**: no action buttons (view only).

### Sending validation UX
If API returns 422 (insufficient stock), parse error message and show as toast.error with product name and available qty.

## Acceptance Criteria
- [ ] Draft transfer creation works end-to-end; doc_number displayed in list.
- [ ] Sending a transfer deducts source stock (verify via `/warehouse/stock/on-hand` call in UI or psql).
- [ ] Receiving a transfer shows received badge and disables further actions.
- [ ] Attempting to send with insufficient stock shows user-readable toast error, not a raw JSON dump.
- [ ] Status tabs filter the list correctly.
- [ ] Responsive: table hidden on mobile, card list shown.
- [ ] All strings in i18n files.
- [ ] No `window.confirm()`.

## How We'll Know It's Done
Full workflow completed in browser: create → send → receive. Transfer list shows correct status at each step. At 375px: card view renders without overflow.
