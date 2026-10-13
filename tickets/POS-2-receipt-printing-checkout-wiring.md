# POS-2 — Chek chop etishni checkout oqimiga ulash (ESC/POS + HTML fallback)

**Spec**: `tickets/SPEC-pos-hardware.md`

## Goal

Mavjud, lekin hech qayerda ishlatilmaydigan `lib/bt-printer.ts` (Web Bluetooth ESC/POS) va
`/settings/print-templates` + `/settings/receipt` sozlamalarini desktop POS'ning `checkout()`
oqimiga ulash — sotuv tugagandan keyin haqiqiy chek chop etilsin (Web Bluetooth printer ulangan
bo'lsa) yoki `window.print()` asosidagi HTML fallback ko'rsatilsin (ulanmagan/qo'llab-
quvvatlanmaydigan holatda).

## Files likely touched

- `apps/web/app/(dashboard)/pos/page.tsx` — `checkout()` funksiyasi (161-188), yangi "Chekni
  ulash"/"Qayta chop etish" tugmalari
- `apps/web/lib/bt-printer.ts` — kerak bo'lsa kichik kengaytirish (shablon-asosida matn qurish
  helper, hozirgi `printReceipt()` qattiq-kodlangan formatni shablon placeholder'lari bilan
  almashtirish)
- **Yangi**: `apps/web/lib/receipt-render.ts` (taklif) — `/settings/print-templates` body'sidagi
  `{org_name}`, `{doc_number}`, `{sale_date}`, `{items}`, `{total}`, `{paid}`, `{currency}`,
  `{footer}` placeholder'larini haqiqiy sotuv ma'lumoti bilan to'ldiruvchi sof funksiya (ham
  ESC/POS, ham HTML fallback shu bitta render natijasidan foydalansin — ikki marta format
  yozilmasin)
- `apps/web/app/(dashboard)/settings/print-templates/page.tsx` — o'zgarishsiz, faqat manba

## How we'll know it's done

- `/settings/receipt`da `auto_print=true` va Web Bluetooth printer POS ekranida ulangan holatda:
  sotuv tugagandan keyin chek avtomatik ESC/POS formatda chop etiladi (haqiqiy 58mm/80mm termoprinter
  bilan sinaladi)
- Printer ulanmagan holatda: "Chekni chop etish" tugmasi bosilganda `window.print()` oynasi
  `/settings/receipt`dagi `width_mm` (58/80/A4)ga mos `@page` o'lchami bilan ochiladi, shablon
  matni to'g'ri to'ldirilgan holda ko'rinadi
- Chop etish xatosi (printer uzilib qolgan, va h.k.) sotuvni bekor qilmaydi — sotuv allaqachon
  yaratilgan, faqat toast.error + "qayta urinish" imkoni beriladi
- Shablon mavjud bo'lmaganda (yangi tashkilot, hali shablon yaratmagan) — built-in default matn
  bilan baribir chop etiladi (xato bermaydi)

## Owner role

`frontend-dev`

## Depends on

none (POS-1 bilan parallel ishlash mumkin)
