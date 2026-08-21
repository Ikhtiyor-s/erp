# T-2 — mobile-card-pattern

## Goal

10 ta eng faol dashboard jadval sahifasiga mobile-card pattern qo'shish: `<div className="hidden md:block">` (desktop jadval, o'zgarmaydi) + `<ul className="md:hidden">` (mobile cards, yangi). 375px da foydalanuvchi ma'lumotlarni o'qiy olsin.

## Acceptance criteria

- Quyidagi 10 ta sahifaning har birida `<ul className="md:hidden">` bloki mavjud:
  1. `apps/web/app/(dashboard)/admin/roles/page.tsx`
  2. `apps/web/app/(dashboard)/sale/sales/page.tsx`
  3. `apps/web/app/(dashboard)/warehouse/products/page.tsx`
  4. `apps/web/app/(dashboard)/customer/list/page.tsx`
  5. `apps/web/app/(dashboard)/finance/transactions/page.tsx`
  6. `apps/web/app/(dashboard)/warehouse/categories/page.tsx`
  7. `apps/web/app/(dashboard)/supplier/list/page.tsx`
  8. `apps/web/app/(dashboard)/sale/customer-payments/page.tsx`
  9. `apps/web/app/(dashboard)/warehouse/warehouses/page.tsx`
  10. `apps/web/app/(dashboard)/admin/audit-log/page.tsx`
- 375px da har sahifada card ro'yxat ko'rinadi, gorizontal scroll yo'q
- 768px+ da desktop jadval ko'rinadi, card yashirilgan
- Har card'da: sarlavha (birinchi muhim ustun), kamida 1 ta qo'shimcha ma'lumot, amallar tugmalar (agar mavjud bo'lsa)
- Mavjud desktop jadval logikasi, filterlash, pagination o'zgarmaydi
- `docker compose build web` TypeScript xatosiz tugaydi

## Pattern (reference)

`apps/web/app/(dashboard)/admin/users/page.tsx` — mavjud namuna. Shu faylni o'qib pattern'ni ko'chiring:

```tsx
{/* Desktop table */}
<div className="hidden md:block">
  <table>...</table>
</div>

{/* Mobile cards */}
<ul className="md:hidden space-y-3">
  {items.map((item) => (
    <li key={item.id} className="bg-white rounded-lg border p-4">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-medium text-ink-900">{item.name}</p>
          <p className="text-sm text-ink-500">{item.secondaryField}</p>
        </div>
        <div className="flex gap-2">
          {/* action buttons */}
        </div>
      </div>
    </li>
  ))}
</ul>
```

## Files likely touched

- `apps/web/app/(dashboard)/admin/roles/page.tsx`
- `apps/web/app/(dashboard)/sale/sales/page.tsx`
- `apps/web/app/(dashboard)/warehouse/products/page.tsx`
- `apps/web/app/(dashboard)/customer/list/page.tsx`
- `apps/web/app/(dashboard)/finance/transactions/page.tsx`
- `apps/web/app/(dashboard)/warehouse/categories/page.tsx`
- `apps/web/app/(dashboard)/supplier/list/page.tsx`
- `apps/web/app/(dashboard)/sale/customer-payments/page.tsx`
- `apps/web/app/(dashboard)/warehouse/warehouses/page.tsx`
- `apps/web/app/(dashboard)/admin/audit-log/page.tsx`

## Owner role

`frontend-dev`

## Depends on

`T-1` (maydon eni to'g'rilanishi kerak, aks holda card ichida ham overflow bo'lishi mumkin)

## Estimated effort

M (1.5 soat)
