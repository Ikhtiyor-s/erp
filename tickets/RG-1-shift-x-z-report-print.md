# RG-1 — Smena X/Z-hisobotini bosib chiqarish (chek printerda)

**Spec**: `tickets/SPEC-regos-gap.md`

> ⚠️ Eslatma: bu funksiya **fiskal Z-report emas** (fiskal = davlat sertifikatlangan VCR,
> bloklangan to'plam). Bu — ichki kassa-nazorat hisoboti: smena davomida qancha kirim/chiqim
> bo'lgani, necha ta sotuv o'tgani, kassadagi kutilgan vs haqiqiy pul farqi. Ma'lumot allaqachon
> bazada bor — faqat chiqarish formati yetishmaydi.

## Goal

`cashbox_sessions` ma'lumotlarini (aktiv holatda — "X-report", yopishda — "Z-report") mavjud
ESC/POS chek printer infratuzilmasi orqali bosib chiqarish imkoniyatini qo'shish.

## Files likely touched

- `apps/web/lib/bt-printer.ts` — yangi `printShiftReport(session, totals)` funksiyasi (mavjud
  `printReceipt`/`btPrint` naqshiga parallel)
- `apps/web/app/(dashboard)/finance/cashbox-sessions/page.tsx` — "Chop etish" tugmasi (yopilgan
  va aktiv sessiya uchun)
- `apps/web/app/m/cashbox/page.tsx` — mobil kassa sahifasida ham xuddi shu tugma
- `apps/api/app/modules/mobile/router.py` — agar kerak bo'lsa, `/cashbox-sessions/{sid}` ga
  to'lov turi bo'yicha breakdown qo'shish (`cash_movements.payment_type_id` bo'yicha GROUP BY) —
  hozirgi `close_session` faqat umumiy `total_income`/`total_expense` qaytaradi, naqd/karta
  ajratilmagan

## How we'll know it's done

- Aktiv smenada "X-hisobot" tugmasi bosilsa — joriy kirim/chiqim/sotuv soni ESC/POS formatda
  chop etiladi (yopilmaydi, faqat ko'rinish)
- Smena yopilganda "Z-hisobot" avtomatik yoki tugma orqali chop etiladi — yakuniy summalar +
  kutilgan vs kiritilgan balans farqi (`closed_diff`) ko'rinadi
- Agar to'lov turi breakdown qo'shilsa — naqd va karta alohida qatorda chiqadi
- Printer ulanmagan holatda xato toast ko'rsatiladi, ilova crash qilmaydi

## Owner role

`frontend-dev` (backend o'zgarishi — breakdown — ixtiyoriy, kichik `backend-dev` qo'shimchasi
bilan)

## Depends on

none
