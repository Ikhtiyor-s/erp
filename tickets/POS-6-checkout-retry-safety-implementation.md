# POS-6 — Checkout retry-xavfsizligini amalga oshirish (POS-5 qaroriga bog'liq)

**Spec**: `tickets/SPEC-pos-offline.md`

## Goal

POS-5 arxitektor qaroriga muvofiq, POS checkout oqimini takroriy-yuborish/duplicate-sotuv xavfidan
himoyalash. **Bu ticketning aniq qamrovi POS-5 tugaguncha NOMA'LUM** — quyida har bir variant
uchun taxminiy ish ko'rsatilgan, lekin boshlashdan oldin POS-5 DESIGN hujjati tasdiqlangan bo'lishi
shart.

## Files likely touched (variantga qarab)

- **Variant A (hech narsa)**: ticket yopiladi, fayl o'zgarmaydi
- **Variant B (idempotency-key)**:
  - `apps/api/app/core/idempotency.py` — yangi (T-208 dizayni asosida)
  - `apps/api/app/modules/sale/router.py` — `POST /sale/sales`ga decorator/middleware
  - `apps/api/app/db/schema_patches.py` — `idempotency_keys` jadvali
  - `apps/web/app/(dashboard)/pos/page.tsx` — `checkout()` har chaqiruvda UUID `Idempotency-Key`
    header yuborsin, tarmoq xatosida avtomatik bir marta qayta urinsin (bir xil key bilan)
  - `apps/api/tests/test_idempotency.py`
- **Variant C (to'liq offline)**: POS-5 DESIGN hujjatida belgilangan fayl ro'yxati (bu ticket
  fayli o'zi YETARLI darajada batafsil bo'lmaydi — POS-5 o'z DESIGN hujjatida aniqlashtiradi,
  zarur bo'lsa bu ticket POS-5dan keyin qayta yoziladi/bo'linadi)

## How we'll know it's done

- **Variant B**: bir xil `Idempotency-Key` bilan ikki marta `POST /sale/sales` yuborilganda — faqat
  bitta `sales` yozuvi DB'da, ikkinchi javob keshlangan natija (T-208'dagi acceptance mezonlariga
  mos, 1x1); POS ekranidagi haqiqiy "Оплатить" tugmasi shu yo'ldan foydalanadi (ikkinchi,
  himoyalanmagan yo'l yo'q — Biznes POS xatosi takrorlanmagan, kod review'da tekshiriladi)
- **Variant C**: POS-5 DESIGN hujjatidagi acceptance mezonlari bajariladi

## Owner role

`backend-dev` (variant B) + `frontend-dev` (checkout wiring) — yoki to'liq qayta belgilanadi
(variant C)

## Depends on

POS-5 (qamrov shu natijaga qarab belgilanadi — bu ticket POS-5 tasdiqlanmaguncha BOSHLANMAYDI)
