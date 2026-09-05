# T-135: Frontend — Barcode print integratsiya (products page)

**Wave:** 4D
**Owner:** frontend-dev
**Size:** S
**Depends on:** T-103

## Goal
`products/page.tsx` va product detail sahifasiga `label-print.tsx` orqali "Etiketka chop etish" tugmasi qo'shish.

## Files likely touched
- `apps/web/app/(dashboard)/products/page.tsx` (multi-select + bulk print)
- `apps/web/components/barcode/label-print.tsx` (T-103'dan)

## UI qo'shimchalar
- Products jadvalida checkbox (multi-select).
- Tanlangan (1+) mahsulotda "Etiketka chop etish" action tugmasi paydo bo'ladi.
- Bosganda: format tanlash (A4 / 58mm) → PDF preview → "Chop etish".
- Bitta mahsulot detail sahifasida ham "Etiketka" tugmasi.

## Acceptance criteria
- Multi-select: max 100 ta mahsulot (ko'p bo'lsa warning).
- Format tanlash `ConfirmDialog` yoki simple modal (window.confirm taqiqlanadi).
- `barcode` field bo'sh mahsulot uchun barcode sifatida `product.sku` yoki `product.id` ishlatiladi.
- 1280px desktop'da ishlaydi (mobile uchun print ixtiyoriy).

## How we'll know it's done
3 ta mahsulot tanlab "Etiketka chop etish" bosganda A4 PDF preview ochiladi; 3x har mahsulot barcode label ko'rinadi.
