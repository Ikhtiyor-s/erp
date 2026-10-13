# RG-5 — HR: xodim ish jadvali + kelish-ketish nazorati (timesheet)

**Spec**: `tickets/SPEC-regos-gap.md`

> ⚠️ Eslatma: bu **kassir smenasi (`cashbox_sessions`) bilan ARALASHMAYDI** — u allaqachon bor
> (1-qatorga qarang). Bu — umumiy xodim ish jadvali (ombor, ofis, savdo xodimi ham) va kelish-
> ketish qayd etish, keyinchalik `payroll_items`ga asos bo'lishi mumkin bo'lgan ma'lumot.
> **Agar egasi faqat kassir smenasini nazarda tutgan bo'lsa — bu ticket kerak emas, SPEC'dagi
> "Ochiq savollar"ga javob bering.**

## Goal

`hr` moduliga ish jadvali (kim qachon ishlaydi) va kelish-ketish (clock-in/clock-out) qo'shish —
hozir `hr/router.py`da faqat positions/employees/KPI/roles, `payroll_router.py`da faqat oylik
ish haqi runlari bor, lekin kim qachon kelgani/ketgani haqida hech qanday jadval yo'q.

## Files likely touched

- `apps/api/app/db/schema_patches.py` — yangi `employee_shifts` (rejalashtirilgan: employee_id,
  work_date, start_time, end_time) va `employee_attendance` (haqiqiy: clock_in, clock_out,
  shift_id FK) jadvallari
- `apps/api/app/modules/hr/router.py` — yangi endpointlar: `GET/POST /hr/shifts`,
  `POST /hr/attendance/clock-in`, `POST /hr/attendance/clock-out`, `GET /hr/attendance`
  (davr bo'yicha filter)
- `apps/api/app/modules/rbac/permissions.py` — `hr.shifts.manage`, `hr.attendance.view`
  (mavjud `hr.payroll.*` naqshiga parallel)
- `apps/web/app/(dashboard)/hr/` — yangi sahifa: jadval kalendar ko'rinishi + kelish-ketish
  jadvali

## How we'll know it's done

- Admin xodimga haftalik jadval tayinlay oladi (`POST /hr/shifts`)
- Xodim (yoki nazoratchi uning nomidan) clock-in/clock-out qila oladi, vaqt serverda qayd etiladi
  (klient vaqtiga ishonilmaydi)
- `GET /hr/attendance?employee_id=&from=&to=` — jamlangan soat/kech qolish hisoboti qaytaradi
- `organization_id` filter har joyda (tenant isolation) — boshqa org xodimining jadvali
  ko'rinmaydi
- Mavjud `payroll_items`ga avtomatik bog'lash **bu ticket doirasida emas** — alohida keyingi
  ticket (agar kerak bo'lsa)

## Owner role

`backend-dev` (UI — kichik, shu ticket ichida; agar DESIGN bosqichida katta deb topilsa,
frontend qismi alohida ticketga ajratilishi mumkin)

## Depends on

none
