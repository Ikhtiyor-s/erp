# T-134: Frontend — Barcode scan integratsiya (mobile POS + warehouse pick)

**Wave:** 4D
**Owner:** frontend-dev
**Size:** S
**Depends on:** T-102

## Goal
`scanner.tsx` component'ni mobile POS (`/m/pos/page.tsx`) va warehouse pick sahifalariga ulash.

## Files likely touched
- `apps/web/app/m/pos/page.tsx` (scan tugma + BarcodeScanner)
- `apps/web/app/m/warehouse/page.tsx` (pick workflow — scan qo'shish)
- `apps/web/components/barcode/scanner.tsx` (T-102'dan)

## POS integratsiya
- "Scan" tugmasi (Camera icon) qo'shiladi.
- `onScan(code)` → `GET /products?barcode={code}` → mahsulot topilsa kartaga qo'shiladi.
- Topilmasa toast.error.

## Warehouse pick integratsiya
- Pick list'da "Scan to confirm" tugmasi.
- `onScan(code)` → scan qilingan mahsulot pick listda avtomatik belgilanadi.
- Noto'g'ri mahsulot scanlansa — vibrate + error toast.

## Acceptance criteria
- BarcodeScanner modal yoki bottom sheet'da ochiladi (full screen emas).
- Kamera permission yo'q bo'lsa tushunarli xato matn.
- Scan muvaffaqiyatli bo'lganda modal yopiladi.
- 375px mobile ko'rinadi.

## How we'll know it's done
Mobile POS'da "Scan" tugma bosganda kamera ochiladi; real barcode scan qilinganda mahsulot savat'ga qo'shiladi.
