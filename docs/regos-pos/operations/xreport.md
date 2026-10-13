# X-hisobot

Manba: `docs.regos.uz/ru/regos-pos/operations/xreport`

X-hisobot — joriy ochiq smena uchun oraliq (yakunlanmagan) hisobot.
Z-hisobot — smena yopilganda chiqadigan yakuniy hisobot (shakli bir xil,
lekin "yakuniy" sifatida).

## REGOS'dagi maydonlar to'liq ro'yxati

- Sotuvlar soni
- Sotilgan qatorlar soni
- Sotilgan birliklar soni
- Bekor qilingan (sторno) sotuvlar soni
- Naqd / karta / bonus to'lov jami summalari
- Umumiy jami
- Qaytarishlar soni
- Qaytarilgan qatorlar soni
- Qaytarilgan birliklar soni
- Bekor qilingan qaytarishlar soni
- Qaytarishlar bilan birga umumiy jami
- Smena ochilishidagi naqd qoldiq
- Naqd kirim taqsimoti: sotuvlardan / qaytimdan / boshqa
- Naqd chiqim taqsimoti: qaytarishlar uchun / qaytim uchun / boshqa
- Smena yopilishidagi naqd qoldiq

## Aniq ERP holati

⚠️ **Qisman, maydon-boma-maydon tasdiqlanmagan.**

`printShiftReport()` (`apps/web/lib/bt-printer.ts`, RG-1 ticketi,
2026-10-12 sessiyasida qurilgan) X/Z hisobotni chop etadi — lekin bu
hujjatlar to'plami tayyorlangan paytda yuqoridagi ro'yxat bilan
**maydon-boma-maydon solishtirilmagan**. Ayniqsa quyidagilar ehtimol yo'q
yoki to'liq emas, chunki ularning manba-ma'lumoti boshqa yo'q funksiyalarga
bog'liq:

- **Bekor qilingan (sторno) sotuvlar/qaytarishlar soni** — hisoblab
  bo'lmaydi, chunki sторno tushunchasi o'zi yo'q (`general-information.md`).
- **Naqd kirim/chiqim taqsimoti** (sotuvdan/qaytimdan/boshqa va
  qaytarishdan/qaytimdan/boshqa) — manba-ma'lumoti endi bor (2026-10-13:
  [`additional-functions.md`](additional-functions.md)dagi "kassaga naqd
  kiritish/chiqarish" POS ekraniga ulandi, `cash_movements.description`
  orqali sababi yoziladi), lekin **X-hisobotning o'zi hali shu yangi
  ma'lumotni "sotuvdan/boshqa" kabi toifalarga ajratib chiqarmaydi** — bu
  alohida, kichikroq ish (`printShiftReport()`ni kengaytirish).

## Keyingi qadam

Agar smena hisoboti REGOS darajasida audit qilinishi kerak bo'lsa —
`printShiftReport()`/`renderShiftReportText()`ni yuqoridagi to'liq
ro'yxat bilan maydon-boma-maydon solishtirib chiqish kerak (bu hujjatlar
to'plamida hali qilinmagan, faqat manba-ro'yxat sifatida qayd etilgan).
To'liq to'g'rilash uchun avval sторno va kassa-harakati gaplari yopilishi
kerak — aks holda hisobotning ba'zi ustunlari strukturaviy ravishda
to'ldirilmay qoladi.
