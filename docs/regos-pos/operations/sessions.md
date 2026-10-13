# Smena ochish/yopish

Manba: `docs.regos.uz/ru/regos-pos/operations/sessions`

## REGOS qoidalari

- Agar joriy kassada allaqachon ochiq smena bo'lsa — yangisini ochib
  bo'lmaydi.
- Smenani yopishdan oldin — shu smenaga tegishli **kutish rejimidagi**
  ("Отложен"/"Отложена оплата") hech qanday chek qolmasligi kerak; avval
  ularni yakunlash yoki bekor qilish kerak.
- Ochish VA yopish — ikkalasi ham, agar printer ulangan bo'lsa, avtomatik
  chek chop etadi (ochishda — ochilish varaqasi, yopishda — Z-hisobot).
- **"История смен"** (smenalar tarixi) — barcha o'tgan smenalarni
  ro'yxatlaydi, har biri uchun qayta chop etish imkoniyati bilan.
- **"Сверка итогов"** (terminal solishtirish) — faqat Ingenico
  terminallar uchun alohida tugma (3 daqiqalik timeout, VCR-bog'liq) —
  niche, Aniq ERP'da to'lov-terminal integratsiyasi yo'qligi sababli
  tegishli emas.

## Aniq ERP holati

| REGOS qoidasi | Aniq ERP |
|---|---|
| Ochiq smena bo'lsa — yangisini ochib bo'lmaydi | tekshirilmagan — ehtimol bor (`mobile/router.py` cashbox-session endpointlarida), aniq tasdiqlash kerak |
| Kutish rejimidagi cheklar bo'lsa yopib bo'lmaydi | ❌ Yo'q — chunki "kutish rejimi" tushunchasining o'zi yo'q (`general-information.md`ga qarang), blok qiladigan narsa yo'q |
| Ochish/yopishda avtomatik chek | ✅ Qisman — `printShiftReport()` (`bt-printer.ts`, RG-1, 2026-10-12) X/Z hisobotni chop etadi, lekin bu "avtomatik" emas — kassir qo'lda "Chop etish" tugmasini bosishi kerak |
| Smenalar tarixi + qayta chop etish | ✅ Bor — `finance/cashbox-sessions` sahifasi |
| Terminal solishtirish (Ingenico) | — tegishli emas (terminal integratsiyasi yo'q) |

## Keyingi qadam

Asosiy gap — "kutish rejimidagi cheklar" tushunchasi yo'qligi sababli,
smena yopishni blokirovka qilish ham yo'q. Bu alohida ticket emas —
[`general-information.md`](sales-registration/general-information.md)dagi
park/defer ticketi qurilgandan keyin, shu yerga ham qo'shimcha shart
sifatida qo'shiladi.
