# T-5 — portal-modal-field-fix

## Goal

Uchta muammoni bir ticket'da hal qilish: (1) `Field` component'ga `htmlFor`/`id` bog'liqlik qo'shish, (2) portal modallarini `<Modal>` komponentiga (focus trap built-in) ko'chirish, (3) cart `submitOrder` uchun 20 soniya timeout va xato handling qo'shish.

## Acceptance criteria

### Field component htmlFor (H-8)
- `apps/web/components/ui/modal.tsx` da `Field` component (qator 129-142 atrofida) yangilangan:
  - Prop: `id?: string` qabul qiladi
  - `<label>` elementida `htmlFor={id}` atributi bor (agar `id` berilsa)
  - `<input>` (yoki `<select>`) elementida `id={id}` atributi bor (agar `id` berilsa)
- Backward compatible: `id` berilmagan joylarda avvalgi kabi ishlaydi
- Label bosilganda tegishli input'ga focus o'tadi (manual test)

### Portal modallar focus trap (H-7)
- `apps/web/app/(portal)/portal/sales/page.tsx` da barcha modal'lar `<Modal>` komponentidan foydalanadi (`import { Modal } from "@/components/ui/modal"`)
- `apps/web/app/(portal)/portal/products/page.tsx` da barcha modal'lar `<Modal>` komponentidan foydalanadi
- Grep tekshiruvi: har ikkala faylda `role="dialog"` yoki boshqa DIV-based custom modal yo'q
- Modal ochiq paytda Tab klavishasi focus'ni modal chegarasidan chiqarmaydi (manual test)
- Modal yopish: ESC klavishasi yoki yopish tugmasi ishlaydi

### Cart submitOrder timeout (H-5)
- `apps/web/app/(portal)/portal/cart/page.tsx` dagi `submitOrder` (yoki `handleCheckout`) funksiyasi:
  - Axios so'rovida `{ timeout: 20000 }` option mavjud (yoki `AbortController` bilan 20s)
  - Bitta retry: timeout yoki network xato bo'lsa bir marta qayta urinadi
  - Xato bo'lsa: `toast.error(getErrorMessage(e, "Buyurtma yuborishda xato"))` ko'rsatiladi
  - Muvaffaqiyatli bo'lsa: `toast.success("Buyurtma yuborildi")` (avvalgi kabi)
- `docker compose build web` TypeScript xatosiz tugaydi

## Files likely touched

- `apps/web/components/ui/modal.tsx`
- `apps/web/app/(portal)/portal/sales/page.tsx`
- `apps/web/app/(portal)/portal/products/page.tsx`
- `apps/web/app/(portal)/portal/cart/page.tsx`

## Owner role

`frontend-dev`

## Depends on

`none`

## Estimated effort

S (30 daqiqa)
