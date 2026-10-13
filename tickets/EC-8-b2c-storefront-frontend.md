# EC-8 — B2C storefront frontend: katalog + savat + checkout

**Spec**: `tickets/SPEC-ecommerce-b2c.md`

## Goal

Yangi, hech qanday login talab qilmaydigan public Next.js route group yaratish: mahsulot katalogi
(kategoriya filtri, rasm, stock holati), savatcha (client-side state), checkout formasi (ism+telefon,
yetkazib berish/olib ketish eslatmasi), va buyurtma tasdiqi sahifasi ("to'lov kutilmoqda" yoki to'lov
linkiga yo'naltirish).

## Files likely touched

- Yangi: `apps/web/app/(shop)/shop/page.tsx` — katalog
- Yangi: `apps/web/app/(shop)/shop/[productId]/page.tsx` — mahsulot detali
- Yangi: `apps/web/app/(shop)/shop/cart/page.tsx` — savat
- Yangi: `apps/web/app/(shop)/shop/checkout/page.tsx` — checkout forma
- Yangi: `apps/web/app/(shop)/shop/order/[orderId]/page.tsx` — tasdiq sahifasi
- `apps/web/lib/` — yangi API client funksiyalari `/shop/*` endpointlari uchun (mavjud `customer-portal` client konventsiyasiga mos)

## How we'll know it's done

- Login qilmagan holda `/shop` sahifasi ochiladi, mahsulotlar ko'rinadi, kategoriya bo'yicha filtrlanadi
- Savatga qo'shish → checkout → buyurtma yuborish to'liq ishlaydi (manual E2E tekshirish — bu repoda Playwright yo'q)
- Stock tugagan mahsulot savatga qo'shilmaydi / aniq xabar beradi
- To'lov provider yo'q holatda ham foydalanuvchi "buyurtma qabul qilindi, to'lov keyinroq/yetkazib berishda" xabarini ko'radi (hard error emas)
- Mobil kenglikda asosiy oqim ishlaydi

## Owner role

`frontend-dev`

## Depends on

EC-5, EC-6, EC-7
