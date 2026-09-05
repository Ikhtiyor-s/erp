# T-131: Frontend — Mobile qarzdorlik card view

**Wave:** 4D
**Owner:** frontend-dev
**Size:** M
**Depends on:** none (mavjud finance API endpoints ishlatiladi)

## Goal
`/m/finance/debtors/page.tsx` + `/m/finance/debtors/[id]/page.tsx` — mijoz qarzlar mobil ko'rinishi, tez qarz qo'shish/kamaytirish.

## Files likely touched
- `apps/web/app/m/finance/debtors/page.tsx` (yangi)
- `apps/web/app/m/finance/debtors/[id]/page.tsx` (yangi)
- `apps/web/app/m/finance/page.tsx` (link qo'shish)

## API endpoints (mavjud)
- `GET /finance/customer-balance?org_id=&limit=50&offset=0` — qarzdorlar ro'yxati
- `GET /finance/customer-turnover-report?customer_id=&date_from=&date_to=` — aylanma

## List page (`/m/finance/debtors/`)
- Infinite scroll yoki "Ko'proq" tugma
- Har karta: mijoz ismi, telefon, qarz summasi (rose rang), oxirgi to'lov sanasi
- Qidiruv input (ismi yoki telefon)
- Sort: qarz miqdori bo'yicha (kamayish)

## Detail page (`/m/finance/debtors/[id]/`)
- Mijoz info (ism, telefon, manzil)
- Qarz summasi (katta, rose)
- Oxirgi 10 ta tranzaksiya timeline
- "Qarz qo'shish" tugmasi → Modal (summa, izoh)
- "To'lov qabul qilish" tugmasi → Modal (summa, to'lov turi)
- "SMS yuborish" tugmasi → T-132 backend

## Acceptance criteria
- 375px (mobile) birinchi — desktop table yo'q, faqat card/list.
- `getErrorMessage` + `toast.error/success`.
- Loading skeleton.
- `ConfirmDialog` — qarz qo'shish/to'lov confirm.
- Mavjud mobile layout pattern'iga mos (`m/layout.tsx`).

## How we'll know it's done
375px Android Chrome'da `/m/finance/debtors` yuklanadi; mijoz kartasiga kirganda to'lov qabul qilish modali ochiladi va yopiladi.
