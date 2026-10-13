# POS-5 — Arxitektor spike: Aniq ERP POS'ga offline-rezilientlik kerakmi?

**Spec**: `tickets/SPEC-pos-offline.md`

## Goal

Kod yozmasdan, DESIGN hujjati orqali aniq qaror chiqarish: Aniq ERP POS checkout oqimi uchun
(A) hech narsa qilinmaydi, (B) yengil chora (idempotency-key + mahalliy retry, mavjud lekin
qurilmagan `tickets/T-208-idempotency-key-middleware.md` asosida), yoki (C) Biznes POS'ning
`packages/offline-sync` naqshiga o'xshash to'liq IndexedDB offline-first arxitektura — qaysi
biri kerak, va nega.

## Files likely touched

- Kod fayli yo'q (spike)
- **Yangi**: `tickets/DESIGN-pos-offline.md` (yoki shu nomdagi fayl) — repo konvensiyasi bo'yicha
  `specs/templates/DESIGN.template.md` formatida
- Referens (o'qiladi, o'zgartirilmaydi): `D:\Docker\projects\pos\packages\offline-sync\src\*.ts`,
  `D:\Docker\projects\pos\apps\zal-pos\src\pages\POS\screens\POSInterface.tsx`,
  `tickets/T-208-idempotency-key-middleware.md`

## How we'll know it's done

- DESIGN hujjatida uch variantning har biri uchun aniq ustunlik/kamchilik ro'yxati va YAKUNIY
  tanlov bor (taxmin/"ehtimol" so'zlari emas — aniq "tanlanadi: B, sababi: ...")
- SPEC'dagi "Ochiq savollar" bo'limidagi savollarga (internet uzilish chastotasi, Next.js
  offline app-shell yo'qligi) aniq javob/taxmin-asoslash berilgan
- Agar variant C tanlansa — "C1 (sync queue)" va "C2 (offline app-shell/PWA)" aniq ajratilgan,
  ikkinchisi alohida kelajak-spec sifatida belgilangan
- Inson (loyiha egasi) DESIGN hujjatini ko'rib, POS-6 qamrovini tasdiqlagan

## Owner role

`architect`

## Depends on

none
