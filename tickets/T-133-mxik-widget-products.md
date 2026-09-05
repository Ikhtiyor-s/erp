# T-133: Frontend — MXIK katalog qidiruv widget (products page)

**Wave:** 4D
**Owner:** frontend-dev
**Size:** S
**Depends on:** T-101

## Goal
`products/page.tsx` mahsulot create/edit modal'ga MXIK kod qidiruv combobox qo'shish.

## Files likely touched
- `apps/web/app/(dashboard)/products/page.tsx` (modal kengaytirish)
- `apps/web/components/ui/mxik-combobox.tsx` (yangi reusable component)
- `apps/web/i18n/messages/*.json`

## Component: MxikCombobox
```typescript
interface MxikComboboxProps {
  value?: string;  // selected MXIK code
  onChange: (code: string, name: string) => void;
}
```
- `GET /reference/mxik/search?q={input}&limit=10` — debounced 300ms.
- Dropdown: code + name_uz ko'rinadi.
- Tanlagandan keyin mahsulot formasida `mxik_code` field to'ldiriladi.

## Acceptance criteria
- Debounce 300ms — har harfda API call bo'lmaydi.
- Loading spinner qidiruv paytida.
- "Topilmadi" holati ko'rsatiladi.
- `mxik_code` `products` jadvalida saqlanishi kerak — agar `mxik_code` ustun mavjud bo'lmasa `schema_patches.py`'ga `ALTER TABLE products ADD COLUMN IF NOT EXISTS mxik_code VARCHAR(20)` qo'shiladi.
- Responsive (modal ichida ishlaydi).

## How we'll know it's done
Mahsulot yaratish modal'da MXIK combobox'ga "go'sht" yozganda katalog natijalari keladi; tanlaganda mahsulot saqlanadi va MXIK kodi ko'rinadi.
