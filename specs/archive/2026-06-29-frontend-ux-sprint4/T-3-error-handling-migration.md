# T-3 — error-handling-migration

## Goal

Top 20 ta eng faol sahifadagi `e?.response?.data?.detail` (yoki `err?.response?.data?.detail`) antipattern'ini `getErrorMessage(e, "fallback")` helper'ga ko'chirish — xato xabarlari to'g'ri locale'da va fallback bilan ko'rinsin.

## Acceptance criteria

- Grep bilan top 20 ta o'zgartirilgan fayl aniqlanadi va ro'yxat chiqariladi
- Har o'zgartirilgan faylda:
  - `e?.response?.data?.detail` yoki `err?.response?.data?.detail` pattern yo'q
  - `import { getErrorMessage } from "@/lib/api-error"` mavjud (dublikat emas)
  - `toast.error(getErrorMessage(e, "..."))` pattern ishlatilgan
- `grep -rn "response?.data?.detail" apps/web/app/` — tekshirilgan 20 ta faylda 0 natija
- Funksionallik o'zgarmaydi: server `detail` field qaytarsa, u ko'rinadi; bo'lmasa — fallback matn
- `docker compose build web` TypeScript xatosiz tugaydi

## Procedure

1. Grep bilan barcha joylar topiladi:
   ```
   grep -rn "response?\\.data\\?\\.detail" apps/web/app/
   ```
2. Natijadan eng faol 20 ta sahifa (admin/, sale/, warehouse/, finance/, customer/ prioritet) tanlanadi
3. Har faylda:
   - Import qo'shiladi (agar yo'q bo'lsa): `import { getErrorMessage } from "@/lib/api-error"`
   - O'zgartiriladi:
     - `e?.response?.data?.detail || "Xato"` → `getErrorMessage(e, "Xato")`
     - `err?.response?.data?.detail ?? "Muammo"` → `getErrorMessage(err, "Muammo")`
   - Barcha `catch` bloklar tekshiriladi — bir faylda bir nechta joy bo'lishi mumkin

## Priority fayl ro'yxati (grep orqali tasdiqlanadi)

Asosiy scope (CRUD amallar ko'p):
- `apps/web/app/(dashboard)/sale/sales/page.tsx`
- `apps/web/app/(dashboard)/warehouse/products/page.tsx`
- `apps/web/app/(dashboard)/customer/list/page.tsx`
- `apps/web/app/(dashboard)/finance/transactions/page.tsx`
- `apps/web/app/(dashboard)/supplier/list/page.tsx`
- `apps/web/app/(dashboard)/admin/users/page.tsx`
- `apps/web/app/(dashboard)/admin/roles/page.tsx`
- `apps/web/app/(dashboard)/warehouse/categories/page.tsx`
- `apps/web/app/(dashboard)/warehouse/warehouses/page.tsx`
- `apps/web/app/(dashboard)/sale/customer-payments/page.tsx`
- Va grep natijasidan qolgan 10 ta (prioritet: faol CRUD sahifalar)

## Files likely touched

- Yuqoridagi 20 ta sahifa fayli (grep natijasiga qarab aniqlanadi)
- `apps/web/lib/api-error.ts` — TEGMAYDI (helper tayyor, faqat import qilinadi)

## Owner role

`frontend-dev`

## Depends on

`none`

## Estimated effort

S (1 soat)
