# 6. API hujjatlari

ERP backend 159 ta REST endpoint. To'liq interaktiv hujjatlar Swagger UI'da:

**Swagger:** http://localhost:8001/docs
**ReDoc:** http://localhost:8001/redoc
**OpenAPI JSON:** http://localhost:8001/openapi.json

---

## Auth (`/api/v1/auth`)

| Method | Endpoint | Tavsif |
|---|---|---|
| `POST` | `/auth/register` | Yangi foydalanuvchi va tashkilot |
| `POST` | `/auth/login` | Login (email + password) → JWT |
| `POST` | `/auth/refresh` | Refresh token bilan yangi access token |
| `GET`  | `/auth/me` | Joriy user ma'lumoti |

### Login response
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer"
}
```

### Barcha so'rovlarda
```
Authorization: Bearer <access_token>
X-Organization-Id: <uuid>
```

---

## Organization (`/api/v1/organizations`)

| Method | Endpoint | Tavsif |
|---|---|---|
| `GET`  | `/organizations` | Joriy user'ning tashkilotlari |
| `POST` | `/organizations` | Yangi tashkilot |
| `PUT`  | `/organizations/{id}` | Tahrirlash |

---

## Customer (`/api/v1/customer`)

| Method | Endpoint | Tavsif |
|---|---|---|
| `GET`  | `/customer/categories` | Kategoriyalar |
| `POST/PUT/DELETE` | `/customer/categories/{id}` | CRUD |
| `GET`  | `/customer/customers?q=&category_id=&limit=` | Filtrli ro'yxat |
| `POST` | `/customer/customers` | Yaratish |
| `PUT`  | `/customer/customers/{id}` | Tahrirlash |
| `DELETE` | `/customer/customers/{id}` | O'chirish (soft) |
| `GET`  | `/customer/customers/{id}` | **Profile** (head, balance, sales, movements, recent_sales) |
| `GET`  | `/customer/customers/{id}/balance` | Faqat balans |
| `POST` | `/customer/customers/{id}/set-balance` | Balansni qo'lda belgilash |
| `GET`  | `/customer/customers/export` | CSV eksport |
| `POST` | `/customer/customers/import` | CSV import |
| `GET`  | `/customer/balance` | Barcha balanslar |
| `GET`  | `/customer/abc-analysis` | ABC tahlil |
| `GET`  | `/customer/cashback-turnover` | Keshbek aylanmasi |
| `GET`  | `/customer/orders?q=&status=` | Mijoz buyurtmalari |
| `POST` | `/customer/orders` | Yangi buyurtma |
| `PUT`  | `/customer/orders/{id}/status?status=` | Status o'zgartirish |
| `DELETE` | `/customer/orders/{id}` | O'chirish |
| `GET`  | `/customer/analytics-dashboard` | KPI: total, new, active, avg_check, top |
| `GET`  | `/customer/locations-map` | Lokatsiyalar bo'yicha mijozlar |

---

## Supplier (`/api/v1/supplier`)

| Method | Endpoint | Tavsif |
|---|---|---|
| `GET/POST/PUT/DELETE` | `/supplier/suppliers` | CRUD |
| `GET` | `/supplier/suppliers/{id}` | **Profile** (balans, supplies, movements) |
| `GET` | `/supplier/balance` | Barcha balanslar |
| `POST`| `/supplier/suppliers/{id}/set-balance` | Balans belgilash |
| `GET/POST` | `/supplier/supplies` | Sotib olishlar |
| `GET` | `/supplier/supplies/{id}` | Detail |
| `GET/POST/DELETE` | `/supplier/purchase-orders` | Sotib olish buyurtmalari |
| `PUT` | `/supplier/purchase-orders/{id}/status?status=` | Status |

---

## Warehouse (`/api/v1/warehouse`)

34 ta endpoint. Asosiy guruhlar:

### Mahsulot
- `GET /warehouse/products?q=&category_id=&is_service=&kind=&limit=&offset=`
- `POST/PUT/DELETE /warehouse/products/{id}`

### Ombor
- `GET /warehouse/warehouses` — responsible_name + product_count + stock_value JOIN
- `POST/PUT/DELETE /warehouse/warehouses/{id}`

### Kategoriya
- `GET/POST/PUT/DELETE /warehouse/categories/{id}`

### Kirim
- `GET /warehouse/supplies` — yetkazib beruvchidan kirim
- `POST /warehouse/supplies` — yangi kirim

### Inventarizatsiya
- `GET/POST/PUT /warehouse/revisions`
- `POST /warehouse/revisions/{id}/finalize` — yakunlash

### Hisobdan chiqarish
- `GET/POST/PUT/DELETE /warehouse/write-offs`
- `GET/POST/PUT/DELETE /warehouse/write-off-reasons`

### O'tkazma
- `GET/POST /warehouse/transfers`

### Qoldiqlar
- `GET /warehouse/stock?warehouse_id=` — qoldiqlar
- `GET /warehouse/cost-of-goods` — tannarx
- `GET /warehouse/in-stock-report`
- `GET /warehouse/product-statistic` — kirim+chiqim
- `GET /warehouse/product-income` — daromad (profit)
- `GET /warehouse/write-off-report`

---

## Sale (`/api/v1/sale`)

22 endpoint. Asosiy:

### Sotuvlar
- `GET /sale/sales?q=&customer_id=&status=&date_from=&date_to=&limit=`
- `POST /sale/sales` — yangi sotuv (items bilan)
- `GET /sale/sales/{id}` — detail
- `PUT /sale/sales/{id}/cancel` — bekor qilish
- `POST /sale/sales/{id}/pay` — to'lov

### Qaytarish
- `GET/POST /sale/returns`
- `GET /sale/returns/{id}` — detail
- `GET/POST/PUT/DELETE /sale/return-reasons`

### Mijoz to'lovlari
- `GET /sale/customer-payments?customer_id=&date_from=&date_to=`

### Dashboard
- `GET /sale/dashboard` — KPI + 30 kunlik grafik + top mijozlar/mahsulotlar

---

## Finance (`/api/v1/finance`)

24 endpoint:

### Kassa
- `GET/POST/PUT/DELETE /finance/cashboxes` (currency_code + responsible_name JOIN)
- `GET /finance/movements?cashbox_id=&direction=&payment_type_id=&customer_id=&supplier_id=&employee_id=&q=&date_from=&date_to=` — to'liq JOIN'lar
- `POST /finance/movements` — kirim/chiqim
- `POST /finance/transfer` — kassalar orasida

### Balans belgilash
- `POST /finance/cashbox-set-balance`
- `POST /finance/entity-set-balance` (subject_type: customer/supplier/employee/person)

### Qo'shimcha xarajatlar
- `GET/POST/DELETE /finance/extra-costs`

### Hisobotlar
- `GET /finance/turnover?date_from=&date_to=` — kassa aylanmasi
- `GET /finance/customer-turnover`
- `GET /finance/supplier-turnover`
- `GET /finance/employee-turnover`
- `GET /finance/cash-flow?date_from=&date_to=` — kunlik + to'lov turi bo'yicha
- `GET /finance/balance-statistics`
- `GET /finance/price-deviation?date_from=&date_to=`

### Balanslar
- `GET /finance/customer-balance` (yoki `/customer/balance` ham)
- `GET /finance/employee-balance`
- `GET /finance/supplier-balance`
- `GET /finance/person-balance`

---

## Manufacturing (`/api/v1/manufacturing`)

| Method | Endpoint |
|---|---|
| `GET/POST/PUT/DELETE` | `/manufacturing/bom` |
| `GET` | `/manufacturing/bom/{id}` — detail (head + items) |
| `GET/POST` | `/manufacturing/production-orders?q=&status=&responsible_id=&warehouse_id=&date_from=&date_to=` |
| `GET` | `/manufacturing/production-orders/{id}` |
| `POST` | `/manufacturing/production-orders/{id}/start` |
| `POST` | `/manufacturing/production-orders/{id}/finish` (body: produced_qty) |
| `DELETE` | `/manufacturing/production-orders/{id}` — cancel |
| `GET` | `/manufacturing/state-report` |
| `GET` | `/manufacturing/by-responsible` |

---

## HR (`/api/v1/hr`)

| Method | Endpoint |
|---|---|
| `GET/POST/PUT/DELETE` | `/hr/employees?q=&position_id=` (uuid_label + currency_code + balance JOIN) |
| `GET` | `/hr/employees/{id}` — **Profile** (head + balance + productions + kpis + movements) |
| `GET/POST/PUT/DELETE` | `/hr/positions` (employee_count + avg_salary) |
| `GET` | `/hr/roles` |
| `GET/POST/DELETE` | `/hr/kpi?employee_id=` |

---

## Marketing (`/api/v1/marketing`)

| Method | Endpoint |
|---|---|
| `GET/POST/PUT/DELETE` | `/marketing/discounts?q=&is_active=` |
| `GET/POST/DELETE` | `/marketing/expected-products?q=&status=` |
| `PUT` | `/marketing/expected-products/{id}/status?status=` |

---

## Reference (`/api/v1/reference`)

| Method | Endpoint |
|---|---|
| `GET/POST/PUT/DELETE` | `/reference/currencies` |
| `GET/POST/DELETE` | `/reference/currencies/{id}/rates` |
| `POST` | `/reference/currencies/rates/import-cbu` — CBU dan avto |
| `GET` | `/reference/currencies/rates/latest` |
| `GET/POST/PUT/DELETE` | `/reference/units` |
| `GET/POST/PUT/DELETE` | `/reference/payment-types` |
| `GET/POST/PUT/DELETE` | `/reference/locations` |
| `GET/POST/PUT/DELETE` | `/reference/legal-entities` |
| `GET/POST/PUT/DELETE` | `/reference/natural-persons` |
| `GET/POST/PUT/DELETE` | `/reference/price-lists` |
| `GET/POST/DELETE` | `/reference/price-lists/{id}/items` |
| `GET/POST/PUT/DELETE` | `/reference/warehouse-types` |

---

## Statistics (`/api/v1/statistics`)

15 ta hisobot endpoint, har biri sana filtr bilan. CSV eksport ham bor.

---

## Settings (`/api/v1/settings`)

| Method | Endpoint |
|---|---|
| `GET/PUT` | `/settings/organization` |
| `GET/PUT` | `/settings/key/{key}` — JSONB sozlama |
| `GET` | `/settings/keys` — barcha sozlamalar |
| `GET/POST/PUT/DELETE` | `/settings/devices` |
| `GET/POST/PUT/DELETE` | `/settings/print-templates` |

---

## Tasks (`/api/v1/tasks`)

| Method | Endpoint |
|---|---|
| `GET` | `/tasks?q=&status=&assignee_id=&priority=` |
| `POST` | `/tasks` |
| `PUT` | `/tasks/{id}` |
| `PUT` | `/tasks/{id}/status?status=todo|in_progress|done|cancelled` |
| `DELETE` | `/tasks/{id}` |

---

## Tools (`/api/v1/tools`)

| Method | Endpoint |
|---|---|
| `POST` | `/tools/price/bulk-update` — bir-bir narxlarni o'zgartirish |
| `POST` | `/tools/price/markup` — foiz bilan markup |
| `GET` | `/tools/exports/products` — CSV |
| `GET` | `/tools/exports/customers` — CSV |
| `GET` | `/tools/exports/suppliers` — CSV |
| `GET` | `/tools/exports/sales` — CSV |
| `GET` | `/tools/exports/stock` — CSV |

---

## Misol: To'liq workflow

### Mijoz yaratish va sotuv qilish

```bash
# 1. Login
curl -X POST http://localhost:8001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"qa@example.com","password":"Qa12345!"}'
# Response: {"access_token": "...", ...}

export TOKEN="<access_token>"
export ORG="<org_uuid>"

# 2. Yangi mijoz
curl -X POST http://localhost:8001/api/v1/customer/customers \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG" \
  -H "Content-Type: application/json" \
  -d '{"name":"Ali Valiyev","phone":"+998901234567"}'
# Response: {"id": "..."}

# 3. Sotuv
curl -X POST http://localhost:8001/api/v1/sale/sales \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "...",
    "warehouse_id": 1,
    "cashbox_id": 1,
    "sale_date": "2026-06-19",
    "items": [
      {"product_id": "...", "quantity": 2, "price": 50000}
    ]
  }'

# 4. Mijoz profili (yangilangan balans)
curl http://localhost:8001/api/v1/customer/customers/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Organization-Id: $ORG"
```
