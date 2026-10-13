# Mijozlar

Manba: `pospoint.uz/uz/knowledge-base/clients`

## PosPoint nima qiladi

Xaridorlar hisobi, mijozlar bazasi, qarz va xaridlar tarixi.

### Yangi mijoz kiritish

Ismi/familiyasi, telefon, jins, tug'ilgan sana, sodiq mijoz kartasi
raqami, qarz limiti (ixtiyoriy).

**Aniq ERP holati:** ⚠️ qisman. `apps/api/app/modules/customer/router.py`dagi
`CustomerIn` modelida bor: name, code, phone, email, address, tin,
category_id, location_id, notes, ✅ `debt_limit`, ✅ `birthday` (2026-10-14
qo'shildi — `customers.debt_limit NUMERIC`, `customers.birthday DATE`,
`apps/web/app/(dashboard)/customer/customers/page.tsx`dagi formaga ham
ulandi). ❌ **Hali yo'q**: jins. Sodiq mijoz kartasi — `customer/router.py`da
alohida loyalty-karta tushunchasi ko'rinmadi (shtrix-kod-karta emas).

### Mijoz tranzaksiyalari tarixi

Kartochkada: sotish, qaytarish, qarzga sotish, qarzni to'lash.

**Aniq ERP holati:** ✅ bor — `customer_one_balance`/tranzaksiya
so'rovlari `cash_movements`/`sales`dan `customer_id` bo'yicha filtrlanadi
(router.py:246, 255 atrofida).

### Tovarni qarzga sotish + qarz limiti

To'lov oynasida "Qarzga" → mijoz tanlanadi → agar belgilangan limit
oshsa, kassa sotuvni rad etadi.

**Aniq ERP holati:** ✅ qurildi (2026-10-14). Mijoz kartochkasida
sozlanadigan `debt_limit` maydoni bor; `POST /sale/sales` (shu orqali POS,
B2B portal va h.k. ham o'tadi — `sale/service.py::create_sale_core`)
sotuv yaratilayotganda, agar bu sotuv customer'ning umumiy to'lanmagan
qarzini (`SUM(total_amount - paid_amount)` barcha bekor qilinmagan
sotuvlar bo'yicha) limitdan oshirib yuborsa, 422 bilan rad etadi — jonli
production'da to'g'ridan-to'g'ri API orqali sinaldi (limitdan past —
o'tdi, limitdan oshirgan ikkinchi sotuv — bloklandi). `debt_limit = NULL`
— cheklanmagan (standart, eski xatti-harakat saqlanadi). ⚠️ POS to'lov
oynasida "Qarzga" hali alohida to'lov-usuli emas (bu `cash-register.md`da
ham qayd etilgan — bir xil ildiz-sabab) — limitni oshirib yuborish hali
faqat server javobidagi xato xabari orqali ko'rinadi, maxsus UI
ogohlantirish yo'q.

### Qarzdorlarni boshqarish + ortiqcha to'lov balansga o'tishi

"Qarzdorlar" filtri; qarzni qaytarishda agar summa qarzdan ko'p bo'lsa,
qoldiq mijoz balansiga o'tadi va keyingi xaridlarda ishlatiladi.

**Aniq ERP holati:** ✅ qisman bor — `set_customer_balance`/`cash_movements`
orqali balans ijobiy yoki manfiy bo'lishi mumkin (umumiy mexanizm), bu
PosPoint'ning "ortiqcha to'lov balansga o'tadi" xatti-harakatiga
funksional jihatdan yaqin. ❌ Maxsus "Qarzdorlar" filtri/ro'yxat UI'da
aniq ko'rilmadi.

### Tug'ilgan kun egalarini ko'rish

Agar tug'ilgan sana kiritilgan bo'lsa, "Tug'ilgan kun" filtri —
tabriklar/promo rejalashtirish uchun.

**Aniq ERP holati:** ⚠️ qisman — `customers.birthday` maydoni endi bor
(2026-10-14) va mijoz detal sahifasida (`[id]/page.tsx`) ko'rsatiladi.
❌ Hali yo'q: "Tug'ilgan kun" filtri/ro'yxati, va marketing-sms
sozlamasidagi `birthday_template` (`settings/marketing-sms/page.tsx`)
hali hech qanday haqiqiy sanaga ulanmagan — shablon bor, uni avtomatik
yuboradigan kunlik job/cron yo'q.

## Keyingi qadam

Qarz limiti maydoni + enforcement — ✅ bajarildi (2026-10-14). Qolganlar,
ustuvorlik tartibida: (1) marketing-sms modulida tug'ilgan-kun shablonini
haqiqatan yuboradigan kunlik job (hozir shablon "osilib qolgan" — hech
narsani tetiklamaydi); (2) "Qarzdorlar" maxsus filtr/ro'yxat UI'da;
(3) jins maydoni — eng past ustuvorlik.
