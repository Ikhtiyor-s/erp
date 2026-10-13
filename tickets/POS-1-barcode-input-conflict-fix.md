# POS-1 — Desktop POS: barcode-skaner va qidiruv input ziddiyatini tuzatish

**Spec**: `tickets/SPEC-pos-hardware.md`

## Goal

`apps/web/app/(dashboard)/pos/page.tsx`da USB HID barcode skaner bilan skanerlash paytida, agar
qidiruv input fokusda bo'lsa, ikkala yo'l (global `useBarcodeScanner` listener VA input'ning o'z
`onChange`) bir vaqtda ishga tushib API thrash va chalkash UI holati yaratayotgan bugni tuzatish.

## Files likely touched

- `apps/web/lib/scanner.ts` — `useBarcodeScanner` hook (`ignoreInInputs` logikasi, 19-89-qatorlar)
- `apps/web/app/(dashboard)/pos/page.tsx` — qidiruv input (292-306-qatorlar) va `useBarcodeScanner`
  chaqiruvi (97-115-qatorlar)

## Nima tekshirish/tuzatish kerak

1. Haqiqiy USB HID skaner bilan (yoki klaviatura orqali tez-tez belgi yuborish simulyatsiyasi bilan)
   qidiruv input fokusda TURGANDA va fokusda TURMAGANDA ikki holatni ham qo'lda sinab ko'rish —
   hozirgi xatti-harakatni aniq tasdiqlash (taxmin emas, real brauzerda)
2. Qaror: (a) input fokusda bo'lganda ham global scanner ishlasin, lekin flush paytida input qiymatini
   avtomatik tozalasin va keraksiz `loadProducts` chaqiruvlarini debounce/bekor qilsin, YOKI
   (b) `ignoreInInputs:true` qilib, input o'zining mavjud qidiruv-filtrlash oqimidan foydalansin
   (agar backend `/warehouse/products?q=` barcode/sku bo'yicha ham moslashtirilgan bo'lsa) — ikkisidan
   birini tanlash va sababini kod kommentida/PR tavsifida qisqa yozish
3. Mobil POS (`app/m/pos/page.tsx`) kamera-skaner alohida modal orqali ishlagani uchun bu bug unga
   tegishli emas — faqat tasdiqlash uchun qayta tekshirish (regressiya yo'q)

## How we'll know it's done

- Qidiruv input fokusda bo'lganida barcode skanerlanganda: faqat BITTA mahsulot savatga qo'shiladi,
  qidiruv input'da eski/yarim barcode matni QOLMAYDI, va tarmoq tab'da bitta (yoki debounce qilingan)
  `/warehouse/products?q=` so'rovi ko'rinadi — har bir belgi uchun alohida so'rov yo'q
- Input fokusda bo'lmaganda xatti-harakat avvalgidek ishlayveradi (regressiya yo'q)

## Owner role

`frontend-dev`

## Depends on

none
