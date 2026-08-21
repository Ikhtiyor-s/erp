# T-2 — mxik-frontend-ui

## Goal

Products sahifasiga MXIK input field (create va edit modal) va table'da MXIK ustunini qo'shish —
uch viewport (375/768/1280) da ishlashi shart.

## Acceptance criteria

- Product yaratish modal'ida `MXIK` labeled input field mavjud
  - Placeholder: `"Masalan: 0902103000"` (yoki i18n kaliti orqali)
  - Field ixtiyoriy — bo'sh qoldirilsa `null` yuboriladi
- Product tahrirlash (edit) modal'ida ham xuddi shu field mavjud va mavjud qiymatni
  ko'rsatadi
- Desktop table (1280px) da `MXIK` ustuni ko'rinadi
- Mobile card view (375px) da MXIK qiymati ko'rsatiladi (mavjud bo'lsa) —
  `<ul className="md:hidden">` pattern'iga muvofiq
- API xatosi (422) `toast.error(getErrorMessage(e, "MXIK xato"))` orqali ko'rsatiladi
- `window.confirm()` ishlatilmagan — agar delete confirm kerak bo'lsa `ConfirmDialog` ishlatiladi
- Hardcoded `grid-cols-N` ishlatilmagan — `grid-cols-1 sm:grid-cols-2 lg:grid-cols-N` pattern
- i18n: `uz.json`, `ru.json`, `en.json`, `uz-cyrl.json` fayllarida `mxik` va
  `mxik_placeholder` kalitlari qo'shilgan
- `import { api } from "@/lib/api"` ishlatilgan (to'g'ridan-to'g'ri axios emas)

## Files likely touched

- `apps/web/app/(dashboard)/warehouse/products/page.tsx`
- `apps/web/i18n/messages/uz.json`
- `apps/web/i18n/messages/ru.json`
- `apps/web/i18n/messages/en.json`
- `apps/web/i18n/messages/uz-cyrl.json`

## Owner role

`frontend-dev`

## Depends on

`T-1` (backend schema o'zgarishi API'da aks etishi shart — response'da `mxik` field bo'lishi kerak)

## Estimated effort

S (1–2 soat)
