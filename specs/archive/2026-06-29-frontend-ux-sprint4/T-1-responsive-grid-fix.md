# T-1 — responsive-grid-fix

## Goal

Top 25 ta dashboard sahifadagi hardcoded `grid-cols-3/4/5/6` (`sm:`/`md:` prefix'siz) class'larni
`grid-cols-1 sm:grid-cols-2 lg:grid-cols-N` pattern'ga o'zgartirish — telefon (375px) da jadvallar
va kartalar ekrandan chiqib ketmasin.

## Acceptance criteria

- Grep natijasi: `grep -rn "grid-cols-[3-6]" apps/web/app/ | grep -v "sm:" | grep -v "md:" | grep -v "lg:"` — tekshirilgan 25 ta faylda qaytmaydi (0 natija)
- 375px viewport'da quyidagi sahifalar ochiladi va gorizontal scroll yo'q:
  - `/admin/users`, `/admin/roles`, `/admin/audit-log`
  - `/sale/sales`, `/sale/customer-payments`
  - `/warehouse/products`, `/warehouse/categories`, `/warehouse/warehouses`
  - `/customer/list`, `/supplier/list`
  - `/finance/transactions`
  - `/settings/subscription`
- 1280px viewport'da sahifalar avvalgi ko'rinishda qoladi (regression yo'q)
- `docker compose build web` TypeScript xatosiz tugaydi

## Procedure

1. Quyidagi grep bilan to'liq ro'yxat topiladi:
   ```
   grep -rn "grid-cols-[3-6]" apps/web/app/(dashboard)/ | grep -v "sm:" | grep -v "md:" | grep -v "lg:"
   ```
2. Har topilgan joyda:
   - `grid-cols-4` → `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
   - `grid-cols-3` → `grid-cols-1 sm:grid-cols-2 md:grid-cols-3`
   - `grid-cols-5` → `grid-cols-1 sm:grid-cols-2 lg:grid-cols-5`
   - `grid-cols-6` → `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6`
3. Qolgan (Sprint #5) fayllar o'zgartirilmaydi — faqat top 25 ta.

## Files likely touched

- `apps/web/app/(dashboard)/admin/users/page.tsx`
- `apps/web/app/(dashboard)/admin/roles/page.tsx`
- `apps/web/app/(dashboard)/admin/audit-log/page.tsx`
- `apps/web/app/(dashboard)/sale/sales/page.tsx`
- `apps/web/app/(dashboard)/sale/customer-payments/page.tsx`
- `apps/web/app/(dashboard)/warehouse/products/page.tsx`
- `apps/web/app/(dashboard)/warehouse/categories/page.tsx`
- `apps/web/app/(dashboard)/warehouse/warehouses/page.tsx`
- `apps/web/app/(dashboard)/customer/list/page.tsx`
- `apps/web/app/(dashboard)/supplier/list/page.tsx`
- `apps/web/app/(dashboard)/finance/transactions/page.tsx`
- `apps/web/app/(dashboard)/settings/subscription/page.tsx`
- Va grep orqali topilgan qolgan sahifalar (top 25 gacha)

## Owner role

`frontend-dev`

## Depends on

`none`

## Estimated effort

M (1-1.5 soat)
