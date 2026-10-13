# RG-4 — SelfPOS (self-checkout kiosk): mahsulot qarori — hali QURILMAYDI

**Spec**: `tickets/SPEC-regos-gap.md`

> Bu ticket `tickets/POS-4-mobile-scale-parity-decision.md` bilan bir xil naqsh: avval yozma
> qaror, keyin (agar tasdiqlansa) alohida implementatsiya ticketlari ochiladi. **Shu ticket
> doirasida bitta ham qator kod yozilmaydi.**

## Goal

REGOS:SelfPOS — mijoz o'zi skanerlab, kassir login qilmasdan, soddalashtirilgan oqimda sotib
oladigan kiosk rejimi. Aniq ERP'da bunday rejim yo'q (butunlay yangi funksiya). Avval aniqlash
kerak: egasining maqsadli chakana savdo segmenti (kichik do'kon, oshxona, supermarket?) haqiqatan
self-checkout kiosk so'raydimi, yoki bu REGOS'ning boshqa mijoz qatlamini (yirik supermarket
tarmog'i) nishonga olgan funksiyasi — Aniq ERP uchun mos emasmi?

## Files likely touched (FAQAT agar tasdiqlansa, keyingi ticketlarda)

- Qaror hujjati: shu ticket fayliga javob YOKI qisqa `tickets/RG-4-NOTES.md`
- (Agar tasdiqlansa, keyingi ticket) `apps/web/app/kiosk/` (yangi route) — mavjud POS checkout
  logikasining soddalashtirilgan, kassir-login-siz varianti
- (Agar tasdiqlansa) RBAC: kiosk uchun maxsus cheklangan "device token" (har bir sotuvda
  xodim login qilmasdan) — xavfsizlik ta'siri katta, alohida `architect` DESIGN talab qiladi

## How we'll know it's done

- **Agar WON'T DO**: shu ticket faylida aniq sabab bilan yopiladi (masalan "bizning mijozlar
  10-50 kassali do'kon, kiosk ularning narx segmentiga to'g'ri kelmaydi") — kod o'zgarishi yo'q
- **Agar tasdiqlansa**: alohida yangi SPEC ochiladi (`SPEC-self-checkout.md`), chunki bu xavfsizlik
  (kassir-login-siz tranzaksiya) va UI (yangi, kassirga mo'ljallanmagan interfeys) jihatidan
  katta ta'sirga ega — bitta kichik ticket bilan yopib bo'lmaydi

## Owner role

`architect` (mahsulot+texnik qaror uchun egasi bilan tezkor tasdiqlash kerak — avtomatik
qabul qilinmaydi, chunki bu segment-qarori, texnik qaror emas)

## Depends on

none

## Qaror

**TASDIQLANDI.** `tickets/SPEC-self-checkout.md` + `DESIGN-self-checkout-auth.md` + SC-1..6
amalda shu ticketning yozma qarori ochilishidan OLDIN implementatsiya qilingan edi (protsess
buzilishi, 2026-10-12). Loyiha egasi 2026-10-13 sessiyasida bu holatni ko'rib chiqdi va ishni
yakunlashni so'radi — bu amaldagi tasdiqlash hisoblanadi, shu ticket shu bilan yopiladi.

**Ochiq qolgan**: `SPEC-self-checkout.md`dagi "Tasdiqlash kerak bo'lgan ochiq savollar" (pilot
filial/kassa, `max_cart_amount` standart qiymati, Click/Payme kredensial-oldi demo-rejim) hali
real javob bilan to'ldirilmagan — bular biznes-qarorlar, shuning uchun bu yerda taxmin
qilinmadi. Kiosk real foydalanuvchilarga ko'rsatilishidan oldin ushbu 3 savolga aniq javob
berish tavsiya etiladi.
