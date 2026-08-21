# T-6 — aria-label-icon-buttons

## Goal

Top 20 ta icon-only `<button>` (matn yo'q, faqat lucide-react ikonka) elementiga `aria-label` atributi qo'shish — screen reader foydalanuvchilari tugmani aniq eshitsin.

## Acceptance criteria

- Grep bilan topilgan va o'zgartirilgan 20 ta `<button>` elementining har birida `aria-label` atributi mavjud
- `aria-label` qiymatlari O'zbek tilida:
  - O'chirish: `aria-label="O'chirish"`
  - Tahrirlash: `aria-label="Tahrirlash"`
  - Ko'rish / batafsil: `aria-label="Ko'rish"`
  - Yopish: `aria-label="Yopish"`
  - Qo'shish: `aria-label="Qo'shish"`
  - Yuklab olish: `aria-label="Yuklab olish"`
  - Filtr: `aria-label="Filtr"`
- Matn bor tugmalarga (masalan, `<button>Saqlash</button>`) `aria-label` qo'shilmaydi
- `docker compose build web` TypeScript xatosiz tugaydi

## Procedure

1. Icon-only tugmalar topiladi:
   ```
   grep -rn "<button[^>]*>" apps/web/app/ apps/web/components/ | grep -v "aria-label"
   ```
   Natijadan faqat ichida matn bo'lmagan, faqat ikonka (lucide-react component) bo'lgan tugmalar tanlanadi.

2. Top 20 ta (eng faol sahifalar: admin/, sale/, warehouse/, finance/, customer/) uchun `aria-label` qo'shiladi.

3. Misol:
   ```tsx
   // Oldin:
   <button onClick={handleDelete}><Trash className="h-4 w-4" /></button>

   // Keyin:
   <button onClick={handleDelete} aria-label="O'chirish"><Trash className="h-4 w-4" /></button>
   ```

4. Ixtiyoriy yaxshilanish — ikonkaga `aria-hidden="true"` qo'shish (screen reader ikonkani o'tkazib yuboradi, `aria-label` o'qiladi):
   ```tsx
   <button onClick={handleDelete} aria-label="O'chirish">
     <Trash className="h-4 w-4" aria-hidden="true" />
   </button>
   ```

## Priority sahifalar (grep orqali tasdiqlanadi)

- `apps/web/app/(dashboard)/admin/users/page.tsx` — edit/delete tugmalar
- `apps/web/app/(dashboard)/admin/roles/page.tsx` — edit/delete tugmalar
- `apps/web/app/(dashboard)/sale/sales/page.tsx` — view/delete tugmalar
- `apps/web/app/(dashboard)/warehouse/products/page.tsx` — edit/delete tugmalar
- `apps/web/app/(dashboard)/customer/list/page.tsx` — view/edit tugmalar
- `apps/web/app/(dashboard)/finance/transactions/page.tsx` — view tugma
- `apps/web/components/ui/` — shared komponentlardagi icon tugmalar (agar mavjud)
- Va grep natijasidan qolgan sahifalar (top 20 gacha)

## Files likely touched

- Grep natijasiga qarab aniqlanadi — asosan `(dashboard)/*/page.tsx` sahifalar
- `apps/web/components/ui/*.tsx` — shared komponentlardagi icon tugmalar (ehtimol)

## Owner role

`frontend-dev`

## Depends on

`none`

## Estimated effort

S (30 daqiqa)
