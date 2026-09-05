# T-102: Frontend — Barcode scan component

**Wave:** 4A
**Owner:** frontend-dev
**Size:** M
**Depends on:** none

## Goal
`components/barcode/scanner.tsx` — real ishlaydi-gan barcode scanner: Web BarcodeDetector API (Chrome/Android) + ZXing-js fallback.

## Files likely touched
- `apps/web/components/barcode/scanner.tsx` (yangi)
- `apps/web/components/barcode/index.ts` (re-export)
- `apps/web/package.json` (`@zxing/library` npm dependency)

## Component API
```typescript
interface BarcodeScannerProps {
  onScan: (code: string, format?: string) => void;
  onError?: (err: Error) => void;
  className?: string;
}
```

## Acceptance criteria
- Android Chrome: `BarcodeDetector` API ishlatiladi (performant).
- Desktop / Safari: ZXing-js stream decoder fallback.
- Camera permission so'ralmagan holatda `onError` chaqiriladi.
- Component unmount bo'lganda kamera stream to'xtatiladi (leak yo'q).
- `className` prop orqali wrapper o'lchamini boshqarsa bo'ladi.
- Typescript strict — no `any`.

## How we'll know it's done
Android Chrome'da real EAN-13 / QR barcode scan qilinganda `onScan` callback string bilan chaqiriladi; kamera yopilganda stream to'xtaydi.
