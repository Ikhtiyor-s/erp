# RG-2 — Backend: bir tranzaksiyada aralash to'lov (naqd + karta split)

**Spec**: `tickets/SPEC-regos-gap.md`

> ⚠️ Eslatma: bu — ICHKI funksiya, hech qanday tashqi to'lov provayderga (Click/Payme) bog'liq
> emas. "Karta" shu yerda faqat `payment_type_id` sifatida yoziladi (kassada POS-terminalda
> qo'lda urilgan karta to'lovi) — Click/Payme API orqali REAL karta ushlab qolish emas.

## Goal

Bitta sotuvga bir nechta to'lov qatorini (har xil `payment_type_id` + summa) BITTA atomik
so'rovda qabul qilish va yozish imkoniyatini qo'shish — hozir buning uchun `/sales/{id}/pay`ni
necha marta ketma-ket chaqirish kerak (UI harakati emas, va oraliq holatda sale "qisman to'langan"
ko'rinishda osilib qolishi mumkin).

## Files likely touched

- `apps/api/app/modules/sale/router.py` — yangi endpoint YOKI mavjud `/sales/{sale_id}/pay`ni
  kengaytirish: `payments: list[{payment_type_id, cashbox_id, amount}]` qabul qilish
- `apps/api/app/modules/sale/service.py` — `create_sale_core`ga ixtiyoriy `payments` parametri
  (checkout vaqtida darhol to'lov yozish, hozirgi oqimda sale "completed" statusda to'lovsiz
  yaratilishi mumkin bo'lgan muammoni ham yopadi — `apps/web/app/m/pos/page.tsx:188`dagi
  `payments` maydoni hozir backendda **jim tashlab yuboriladi**, buni ham shu ticket tuzatadi)
- `apps/api/app/modules/rbac/permissions.py` — mavjud `sale.pay` ruxsatidan foydalanish (yangi
  ruxsat shart emas, faqat tekshirish)

## How we'll know it's done

- `POST /sale/sales/{id}/pay-split` (yoki tanlangan nom) ga
  `{"payments": [{"payment_type_id": 1, "cashbox_id": 2, "amount": 50000}, {"payment_type_id": 2, "cashbox_id": 2, "amount": 30000}]}`
  yuborilsa — ikkala qator ham `cash_movements`ga yoziladi, `sales.paid_amount` bitta atomik
  tranzaksiyada to'g'ri yig'indiga yetadi
- **MUST**: `sum(payments[].amount)` sale qoldiq summasidan oshsa 422 (haddan tashqari to'lov)
- **MUST**: bitta `payments` qatori xato bo'lsa (masalan noto'g'ri `cashbox_id`) — HECH BIRI
  yozilmaydi (rollback), qisman yozilgan holat yo'q
- Mobil POS checkout'dan yuborilgan `payments` massivi endi backendda haqiqatan ishlov beriladi
  (hozirgi jim-tashlab-yuborish xatosi yo'qoladi)
- Mavjud eski bir-martalik `/pay` endpoint buzilmaydi (regressiyasiz)

## Owner role

`backend-dev`

## Depends on

none

## Holat (2026-10-13)

Ikki qism ham implementatsiya qilindi va testlangan. **Faqat (2)-qism frontend tomonidan
chaqiriladi** — RG-3 o'rniga qurilgan `tickets/RG-7-incremental-payment-panel.md` ketma-ket
bitta-`/pay` modelini tanladi, shuning uchun `POST /pay-split` (1-qism) hozir hech bir UI
tomonidan chaqirilmaydi. Endpoint ataylab o'chirilmadi — to'g'ri, atomik, testlangan va
kelajakda tashqi integratsiya uchun foydali bo'lishi mumkin (batafsil: RG-7 hujjati).
