# T-105: Backend — 1C Buxgalteriya export endpoints

**Wave:** 4A
**Owner:** backend-dev
**Size:** M
**Depends on:** none

## Goal
`GET /finance/export/1c-csv` va `GET /finance/export/1c-xml` — savdo, kassa harakatlari, kontragentlar 1C formatida eksport (offline, tashqi API kerak emas).

## Files likely touched
- `apps/api/app/modules/finance/router.py` (yangi endpoints)
- `apps/api/app/modules/finance/export_1c.py` (yangi — CSV/XML generation logic)
- `apps/api/app/modules/rbac/permissions.py` (`finance.export`)

## Query params
```
GET /finance/export/1c-csv?date_from=2026-01-01&date_to=2026-01-31&type=sales
GET /finance/export/1c-xml?date_from=2026-01-01&date_to=2026-01-31&type=cash
type: sales | cash | counterparties | all
```

## 1C CSV format (simplified)
```
Дата;Документ;Контрагент;Сумма;Оплачено;Тип
2026-01-15;Продажа #1234;ООО Ромашка;1500000;1500000;Наличные
```

## 1C XML format
CommerceML 2.0 subset — `КоммерческаяИнформация > Документ` structure.

## Acceptance criteria
- Response: `Content-Disposition: attachment; filename="1c-export-2026-01.csv"`.
- CSV: UTF-8 BOM (1C talab qiladi).
- XML: CommerceML 2.0 namespace, UTF-8.
- `organization_id` filter.
- `finance.export` permission (accountant + admin grant).
- `date_from` / `date_to` validation — max 366 kun oralig'i.
- Date WHERE pattern: `field >= :df AND field < (:dt::date + INTERVAL '1 day')` — indeks buzilmaydi.

## How we'll know it's done
`GET /finance/export/1c-csv?date_from=2026-01-01&date_to=2026-01-31&type=all` 200 + CSV file qaytaradi; UTF-8 BOM bor; Excel'da ochiladi.
