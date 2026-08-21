# T-4 — pos-mobile-ux

## Goal

POS sahifasidagi touch target (≥44×44px) va Android keyboard height muammolarini tuzatish; 4 ta mobile sahifaga (`m/customers`, `m/hr`, `m/warehouse`, `m/finance`) try/catch error handling qo'shish.

## Acceptance criteria

### POS touch targets (H-3)
- `m/pos/page.tsx` dagi barcha interaktiv `<button>` elementlari `min-h-[44px] min-w-[44px]` (yoki `h-11 w-11` — 44px) class'iga ega
- Grep tekshiruvi: `grep -n "className.*button\|<button" apps/web/app/m/pos/page.tsx` — `h-6`, `h-7`, `h-8` (32px kichik) qolmaydi
- DevTools 375px da barcode/scale/numpad tugmalari bosganda miss bermaydi

### POS keyboard height (H-9)
- `m/pos/page.tsx` dagi `h-[calc(100vh-105px)]` pattern `min-h-screen` yoki `min-h-dvh` bilan almashtirilgan
- Android Chrome DevTools simulatsiyasida virtual keyboard ochilganda asosiy kontent kesilmaydi
- Grep tekshiruvi: `grep -n "calc(100vh" apps/web/app/m/pos/page.tsx` — 0 natija

### Mobile sahifalar error handling (H-6)
- Quyidagi 4 ta faylda har API chaqiruvi `try/catch` bilan o'ralgan:
  - `apps/web/app/m/customers/page.tsx`
  - `apps/web/app/m/hr/page.tsx`
  - `apps/web/app/m/warehouse/page.tsx`
  - `apps/web/app/m/finance/page.tsx`
- Har `catch` blokida: `toast.error(getErrorMessage(e, "Xato"))` (sonner toast)
- `import { getErrorMessage } from "@/lib/api-error"` mavjud
- Xato bo'lganda foydalanuvchi qurilma ekranida toast ko'radi, sahifa "osilmaydi"
- `docker compose build web` TypeScript xatosiz tugaydi

## Files likely touched

- `apps/web/app/m/pos/page.tsx`
- `apps/web/app/m/customers/page.tsx`
- `apps/web/app/m/hr/page.tsx`
- `apps/web/app/m/warehouse/page.tsx`
- `apps/web/app/m/finance/page.tsx`

## Owner role

`frontend-dev`

## Depends on

`T-3` (getErrorMessage import pattern ko'rish uchun foydali, lekin parallel bajarilishi mumkin)

## Estimated effort

S (30-45 daqiqa)
