# T-1 — date-cast-fix

## Goal

5 ta modul faylida WHERE/AND clauselardagi barcha `field::date` cast'larni indeks-do'st pattern
bilan almashtirish: `field >= :df AND field < (:dt::date + INTERVAL '1 day')` — SELECT
clauselardagi display cast'lar saqlanadi.

## Acceptance criteria

- `apps/api/app/modules/finance/router.py` da WHERE clause'da `sale_date::date` qolmaydi — ikkala joy (qator ~590, ~593) tuzatiladi
- `apps/api/app/modules/statistics/router.py` da WHERE clause'da `sale_date::date` qolmaydi — 11 ta joy (qatorlar ~141, 197, 238, 262, 287, 333, 364, 428, 438, 446, 455) tuzatiladi
- `apps/api/app/modules/assistant/tools.py` da WHERE clause'da `::date` cast qolmaydi — 2 ta joy (qator ~45, 46) tuzatiladi
- `apps/api/app/modules/manufacturing/router.py` da `created_at::date` WHERE clause'dan olib tashlanadi — 2 ta joy (qator ~169, 172) tuzatiladi
- `apps/api/app/modules/mobile/router.py:806` da `check_in_at < :dt::date + 1` pattern tekshiriladi va `check_in_at < (:dt::date + INTERVAL '1 day')` ko'rinishiga keltiriladi (yoki allaqachon to'g'ri bo'lsa izoh qoldiriladi)
- Har fayl uchun `Grep -n "::date" <fayl>` orqali butun faylda qolgan WHERE cast'lar topilmaydi — faqat SELECT iboralarda qolishi mumkin
- Replacement pattern bir kunlik oralik uchun: `field >= :td AND field < (:td::date + INTERVAL '1 day')`
- Replacement pattern ikki sanali oralik uchun: `field >= :df AND field < (:dt::date + INTERVAL '1 day')`
- Mavjud barcha testlar PASS: `docker exec erp-api pytest apps/api/tests/ -v`

## Muhim eslatmalar

- **Multi-location xato**: har faylni Grep bilan to'liq skanlab ko'ring, bitta faylda bir nechta cast bo'lishi mumkin (sprint #2 dagi saboq: `sale/router.py` da 2 ta joy bor edi, ticket faqat 1 tasini ko'rsatgan edi)
- **SELECT clauselari saqlanadi**: `DATE(sale_date)` yoki `sale_date::date` SELECT listida qolishi kerak — display formatlash uchun zarur va indeks'ga ta'sir qilmaydi
- **`:td_start` parametr**: agar endpoint'da `date_from == date_to` (bir kun) holat bo'lsa, parametr nomini `td_start` yoki `date_from` saqlab qolsa ham bo'ladi — faqat cast olib tashlanadi
- **`::date` cast bound param'da**: `(:dt::date + INTERVAL '1 day')` iborasidagi `::date` qolishi kerak — bu bound parameter'ni date turga keltirish, WHERE field'ga cast emas

## Files likely touched

- `apps/api/app/modules/finance/router.py`
- `apps/api/app/modules/statistics/router.py`
- `apps/api/app/modules/assistant/tools.py`
- `apps/api/app/modules/manufacturing/router.py`
- `apps/api/app/modules/mobile/router.py`

## Owner role

`backend-dev`

## Depends on

`none`

## Estimated effort

M (1.5-2 soat)
