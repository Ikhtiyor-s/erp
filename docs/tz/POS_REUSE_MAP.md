# POS Reuse Map — Aniq ERP

> Yaratilgan: 2026-09-05
> Holat: **PLACEHOLDER** — POS repo klonlashga ruxsat berilmadi (Variant C tanlandi)

---

## Kirish

Foydalanuvchi GitHub'dagi 2 ta POS repolarni klonlashga ruxsat bermadi. Shu sababli bu hujjat
minimal placeholder sifatida taqdim etiladi. POS kodini ko'rmasdan to'liq reuse tahlili mumkin emas.

---

## TODO: Foydalanuvchi POS klonlashga ruxsat berganda

Quyidagi elementlar POS repolardan tahlil qilinadi:

1. **Barcode scanner UI komponent** — mavjud scanner.tsx yoki boshqa barcode input wrapper
2. **Product/barcode lookup komponentlari** — offline/online qidiruv logikasi
3. **Sale formatlar** — POS sotuv hujjati strukturasi ERP `sales` jadvaliga qanday mapping qiladi
4. **Return formatlar** — POS qaytarish `sale_returns` ga qanday mapping qiladi
5. **Swagger/OpenAPI namuналар** — POS chiqaradigan va kutiladigan JSON formatlar
6. **Offline queue mexanizmi** — POS tarmoq uzilganda qanday saqlaydi va sync qiladi
7. **Rol va huquqlar** — POS qanday RBAC modelida ishlaydi (cashier, supervisor...)
8. **Stock alert logikasi** — POS qoldiq chegarasini qanday tekshiradi
9. **Hisobot UI komponentlari** — smena hisoboti, kassir hisoboti shakllari
10. **Test senaryolar** — POS'da qaysi E2E va unit testlar mavjud

---

## POS Reuse tavsiyalari

> BO'SH — POS kodi ko'rilmasdan tavsiya berib bo'lmaydi.

---

## ERP'dan POS uchun tayyor elementlar

Hozirgi ERP'da POS bilan sharing uchun ishlatilishi mumkin bo'lgan qismlar:

| Element | ERP joyi | POS uchun foydalanish |
|---|---|---|
| Barcode scanner | `apps/web/components/scanner.tsx` | Direct reuse yoki adapter |
| Product search API | `GET /warehouse/products` | POS product catalog sync |
| Sale create API | `POST /sale/sales` | POS sale submission |
| Sale return API | `POST /sale/sale-returns` | POS return submission |
| Stock balance | `GET /warehouse/products` + stock | POS availability check |
| Cashbox session | `cashbox_sessions` jadval | POS smena open/close |
| Open tickets | `open_tickets` jadval | POS ochiq stol/buyurtma |
| Auth JWT | `POST /auth/login` | POS worker login |

---

## Xulosa

Bu hujjat POS repo klonlashga ruxsat kelganda to'ldiriladi. Shu vaqtgacha
`POS_ERP_API_CONTRACT_DRAFT.md` ERP-tomon perspektivadan tayyorlangan bo'lib,
POS-ERP integratsiya uchun asos sifatida ishlatiladi.
