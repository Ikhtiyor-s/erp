# T-103: Frontend — Barcode print component

**Wave:** 4A
**Owner:** frontend-dev
**Size:** M
**Depends on:** none

## Goal
`components/barcode/label-print.tsx` — JsBarcode + jsPDF bilan mahsulot etiketka generatsiya va chop etish.

## Files likely touched
- `apps/web/components/barcode/label-print.tsx` (yangi)
- `apps/web/package.json` (`jsbarcode`, `jspdf` npm dependencies)

## Component API
```typescript
interface LabelPrintProps {
  items: Array<{
    name: string;
    barcode: string;
    price?: number;
    unit?: string;
  }>;
  format?: "A4" | "58mm";  // default: "A4"
}
// Export: <LabelPrint items={...} /> + openLabelPrint(items) imperative helper
```

## Acceptance criteria
- A4 formatda 4x8 grid (32 etiketka/sahifa).
- 58mm thermal formatda 1 ustun.
- PDF preview `<iframe>` yoki browser print dialog orqali.
- `window.print()` — jsPDF output bilan (to'g'ridan-to'g'ri printer).
- Barcode font: CODE128 (EAN-13 opsional).
- Typescript strict.

## How we'll know it's done
Mahsulot nomi, shtrix-kod va narx ko'rsatilgan PDF preview ochiladi; "Chop etish" bosganda browser print dialog chiqadi.
