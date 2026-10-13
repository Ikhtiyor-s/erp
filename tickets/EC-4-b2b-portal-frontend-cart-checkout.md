# EC-4 — B2B portal frontend: katalog + savat + buyurtma yuborish UI

**Spec**: `tickets/SPEC-ecommerce-b2b.md`

## Goal

Mavjud `(portal)/portal/products` sahifasini kategoriya/rasm/stock/o'ziga xos narx bilan ko'rsatadigan
va savatcha yig'ib buyurtma yubora oladigan qilish; `/portal/sales` sahifasida yangi buyurtma oddiy
sotuv/qarz sifatida ko'rinishini tasdiqlash.

## Files likely touched

- `apps/web/app/(portal)/portal/products/page.tsx` — kategoriya filtri, rasm, stock badge, "savatga qo'sh" tugmasi
- `apps/web/app/(portal)/portal/dashboard/page.tsx` — balans/qarz ko'rinishi (agar yangi buyurtma darhol qarzga qo'shilsa, bu sahifa to'g'ri yangilanishini tekshirish)
- `apps/web/app/(portal)/portal/sales/page.tsx` — yangi onlayn buyurtma oddiy sotuv qatori sifatida ko'rinishi
- Yangi: savat state komponenti (masalan `apps/web/app/(portal)/portal/_components/cart.tsx` — aniq joylashuvi frontend-dev tomonidan mavjud portal struktura konventsiyasiga mos tanlanadi)

## How we'll know it's done

- Mijoz (OTP bilan kirgan) kategoriya bo'yicha mahsulotlarni ko'radi, narxi to'g'ri (segment/shartnoma override hisobga olingan), stock tugagan mahsulotga "savatga qo'sh" bosilmaydi
- Savatni yuborgach, `/portal/sales`da yangi yozuv darhol ko'rinadi, `/portal/dashboard`dagi qarz to'g'ri oshadi
- Mobil kenglikda (responsive) asosiy oqim (katalog→savat→yuborish) ishlaydi — piksel-perfect emas, funksional

## Owner role

`frontend-dev`

## Depends on

EC-1, EC-3
