# RG-7 — Frontend: REGOS-uslubidagi bosqichma-bosqich to'lov paneli (RG-3 ni almashtiradi)

**Spec**: `tickets/SPEC-regos-gap.md`

> **Retroaktiv hujjat** (2026-10-13). Bu ticket RG-3 implementatsiyasi davomida, hech qanday
> alohida PM/architect yozuvisiz, kod ichida pivot qilingan edi (faqat `pos-split-payment.spec.ts`
> sarlavha kommentida "RG-7" deb tilga olingan). Loyiha egasi 2026-10-13 sessiyasida ushbu
> holatni ko'rib chiqdi va shu faylni yozishni tasdiqladi — endi kelgusi sessiyalar uchun
> izlanadigan qaror sifatida qayd etilmoqda.

## Nega RG-3 o'rniga bu?

RG-3 "bir marta: ikki input (naqd+karta summasi) to'ldirib, BITTA tasdiqlash" modelini ko'zda
tutgan edi (RG-2'ning atomik `/pay-split` endpointi orqali). Implementatsiya davomida buning
o'rniga REGOS kassir-ekraniga yaqinroq model tanlangan: kassir summani kiritadi, bitta to'lov
usuli tugmasini bosadi — shu zahoti BITTA `/pay` chaqiruvi yuboriladi va qoldiq kamayadi; qoldiq
0 bo'lguncha takrorlanadi. Bu [[project_erp_regos_pos_workflow]] va
[[feedback_regos_workflow_parity]] xotiralaridagi "to'lov — bosqichma-bosqich" talabiga RG-3'ning
asl dizaynidan ko'ra yaqinroq.

## Qanday ishlaydi (hozirgi kod, `apps/web/app/(dashboard)/pos/page.tsx` va `apps/web/app/m/pos/page.tsx`)

- `ensureSale()` — savatdan birinchi marta to'lov bosqichiga o'tilganda sale yaratiladi (agar
  hali yo'q bo'lsa), keyingi tugmalar shu sale ustida ishlaydi
- `tapPayment(paymentTypeId, amount)` — mavjud bitta-martalik `/sale/sales/{id}/pay` endpointini
  chaqiradi, javobdagi `paid_amount`/`status` asosida qoldiqni qayta hisoblaydi
- Qoldiq 0 ga yetganda "Tasdiqlash" tugmasi yoqiladi
- Testlar: `apps/web/e2e/pos-split-payment.spec.ts`

## RG-2 bilan munosabat

RG-2'ning IKKI qismi bor edi: (1) yangi atomik `POST /pay-split` endpoint, (2) `SaleCreate.payments`
checkout vaqtida jim tashlab yuborilishini tuzatish. **(2) hali ham ishlatiladi va kerak** (B2B/B2C/
kiosk checkout barchasi shu orqali o'tadi — `create_sale_core(payments=...)`). **(1) — `/pay-split`
— hozir frontend tomonidan chaqirilmaydi**, chunki RG-7 ketma-ket bitta-`/pay` modelini tanladi.

`/pay-split` o'chirilmadi: u to'g'ri, atomik, testlangan (8 test) va kelajakda tashqi integratsiya
(masalan API orqali POS bo'lmagan tizimdan bitta so'rovda aralash to'lov yozish) uchun foydali
bo'lishi mumkin. Hozircha **ishlatilmaydigan, lekin ataylab saqlanadigan** alternativ API sifatida
qayd etiladi — `tickets/RG-2-mixed-payment-backend.md` ham shunga mos yangilandi.

## Bilib turish kerak bo'lgan farq (RG-2 MUST bilan solishtirganda)

RG-2 "bitta qatori xato bo'lsa — HECH BIRI yozilmaydi (rollback)" deb talab qilgan edi — bu
`/pay-split`ning o'z ichida to'g'ri ishlaydi. RG-7'ning ketma-ket-`/pay` modelida bunday atomiklik
YO'Q: agar ikkinchi tugma bosilganda tarmoq uzilsa, sale "partial" holatda birinchi to'lov bilan
qoladi. Bu **xato emas** — REGOS'ning o'zi ham shunday ishlaydi (kassir qaytib qolgan qismini
to'lashi mumkin) — ammo kelajakda real foydalanuvchi tajribasida muammo chiqsa, shuni yodda
tutish kerak.

## Holat

**Done** — kod + testlar mavjud, yuqoridagi farq ongli qabul qilingan.
