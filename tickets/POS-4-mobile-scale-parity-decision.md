# POS-4 — Mobil POS'da tarozi: qaror + (agar tasdiqlansa) Web Bluetooth ulash

**Spec**: `tickets/SPEC-pos-hardware.md`

## Goal

Mobil POS (`apps/web/app/m/pos/page.tsx`) hozir hech qanday tarozi integratsiyasiga ega emas (desktop
POS'dagi WebSerial yondashuvi telefon brauzerlarida ishlamaydi). Avval aniq yozma qaror chiqarish:
bu haqiqiy ehtiyojmi (mobil kassada vaznli mahsulot sotiladimi) yoki WON'T DO; agar kerak bo'lsa —
`lib/bt-printer.ts`dagi ishlatilmagan `readScale()` (Web Bluetooth) orqali qo'shish.

## Files likely touched

- Qaror hujjati: shu ticket fayliga yoki qisqa `tickets/POS-4-NOTES.md`ga yozma javob
- (Agar tasdiqlansa) `apps/web/app/m/pos/page.tsx` — tarozi ulash tugmasi/indikator, desktop
  POS'dagi `connectScale`/`scaleWeight` naqshiga o'xshash, lekin `lib/bt-printer.ts`dagi
  `readScale()` (Web Bluetooth) asosida
- (Agar tasdiqlansa) `apps/web/lib/bt-printer.ts` — `readScale()`ni kerak bo'lsa kengaytirish
  (hozir oddiy regex-parse, protokol real qurilmada tasdiqlanishi kerak)

## How we'll know it's done

- **Agar WON'T DO**: shu ticket faylida (yoki SPEC'ning "Ochiq savollar" bo'limida) aniq sabab
  bilan yopiladi — kod o'zgarishi yo'q, boshqa ticketlarga ta'sir qilmaydi
- **Agar tasdiqlansa**: mobil POS'da "Tarozini ulash" tugmasi Web Bluetooth orqali haqiqiy
  elektron tarozi bilan ulanadi, og'irlik real vaqtda ko'rinadi, vaznli mahsulot (`unit=kg/g`)
  savatga qo'shilganda shu og'irlik asosida narx hisoblanadi (desktop POS'dagi logikaga parallel)

## Owner role

`frontend-dev` (qaror uchun PM/mijoz bilan tezkor tasdiqlash kerak bo'lishi mumkin — avtomatik
qabul qilinmaydi, chunki bu mahsulot qarori, texnik qaror emas)

## Depends on

none (boshqa barcha POS-* ticketlar bilan parallel)

## Qaror

**TASDIQLANDI** (retroaktiv, 2026-10-13). Implementatsiya yozma qarordan OLDIN qilingan edi:
`lib/bt-printer.ts`dagi `readScale()` mobil POS'ga (`apps/web/app/m/pos/page.tsx`) ulandi —
tarozi ulash/uzish, real-vaqt og'irlik, vaznli mahsulot narxini og'irlik asosida hisoblash.
Loyiha egasi 2026-10-13 sessiyasida bu holatni tasdiqladi. Real qurilmada protokol (oddiy
regex-parse) hali tekshirilmagan — birinchi real tarozi bilan sinovda kerak bo'lsa moslashtirish
talab qilinadi.
