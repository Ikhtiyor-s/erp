# POS-ERP API Contract Draft

> Yaratilgan: 2026-09-05
> Perspektiva: ERP tomon — POS qanday chaqirishi kutilgan
> Holat: DRAFT — POS kodi ko'rilmagan (Variant C)
> Base URL: `https://{tenant}.aniq.erp/api/v1`

---

## Umumiy qoidalar

| Qoida | Qiymat |
|---|---|
| Auth | `Authorization: Bearer {jwt_access_token}` |
| Tenant | `X-Organization-Id: {org_uuid}` header — har so'rovda shart |
| Content-Type | `application/json` |
| Idempotency | `Idempotency-Key: {uuid}` — sotuv va qaytarish uchun shart |
| Timeout | 20 soniya (ERP standart) |
| Rate limit | `/auth/login` 10/min, boshqalar 60/min |
| Xato format | `{"detail": "...", "code": "...", "field": "..."}` |

---

## Xato kodlari

| HTTP | code | Ma'no |
|---|---|---|
| 400 | VALIDATION_ERROR | Noto'g'ri so'rov parametrlari |
| 401 | UNAUTHORIZED | JWT yo'q yoki muddati o'tgan |
| 403 | FORBIDDEN | Ruxsat yo'q (rol/permission) |
| 404 | NOT_FOUND | Resurs topilmadi |
| 409 | DUPLICATE | Dublikat barcode yoki Idempotency-Key |
| 422 | INSUFFICIENT_STOCK | Yetarli qoldiq yo'q |
| 422 | VALIDATION_ERROR | Biznes qoidasi buzildi |
| 429 | RATE_LIMITED | So'rovlar juda tez |
| 503 | SERVICE_UNAVAILABLE | ERP vaqtincha ishlamaydi |

---

## 1. Auth — JWT olish

### POST /auth/login

POS qurilmasi yoki xodim login paytida JWT oladi.

**Request:**
```json
{
  "email": "cashier@store.uz",
  "password": "securepass",
  "device_id": "POS-DEVICE-001"
}
```

**Response 200:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiJ9...",
  "expires_in": 3600,
  "user": {
    "id": "uuid",
    "full_name": "Ahmadjon Karimov",
    "role": "cashier",
    "organization_id": "org-uuid",
    "permissions": ["sale.create", "sale.view", "warehouse.view"]
  }
}
```

**Response 401:**
```json
{"detail": "Invalid credentials", "code": "UNAUTHORIZED"}
```

### POST /auth/refresh

```json
{"refresh_token": "eyJ..."}
```

**Response 200:**
```json
{"access_token": "eyJ...", "expires_in": 3600}
```

---

## 2. Products Sync — POS lokal DB'ga yuklab olish

POS o'z lokal SQLite yoki IndexedDB'ga tovarlar katalogini yuklab oladi.

### GET /warehouse/products

**Query parameters:**
```
page=1&limit=200&updated_after=2026-09-04T00:00:00Z&include_barcodes=true
```

**Response 200:**
```json
{
  "items": [
    {
      "id": "prod-uuid",
      "sku": "P-001",
      "name": "Pepsi 0.5L",
      "barcode": "4607004530091",
      "extra_barcodes": ["4607004530092", "4607004530093"],
      "category_id": 5,
      "category_name": "Ichimliklar",
      "unit_id": 1,
      "unit_name": "dona",
      "sale_price": 8500.00,
      "purchase_price": 6000.00,
      "is_active": true,
      "is_archived": false,
      "image_url": "https://cdn.aniq.erp/products/prod-uuid.jpg",
      "updated_at": "2026-09-04T12:30:00Z"
    }
  ],
  "total": 1250,
  "page": 1,
  "limit": 200,
  "has_more": true,
  "sync_token": "2026-09-04T12:30:00Z"
}
```

**Eslatma:** POS `updated_after=sync_token` bilan so'nggi sinxronizatsiyadan keyin o'zgarganlarni oladi.

---

## 3. Barcode Lookup — real-time qidiruv

### GET /warehouse/barcode-lookup

**Query parameters:** `q=4607004530091`

**Response 200:**
```json
{
  "product_id": "prod-uuid",
  "name": "Pepsi 0.5L",
  "barcode": "4607004530091",
  "is_primary": false,
  "sale_price": 8500.00,
  "unit_name": "dona",
  "image_url": "https://cdn.aniq.erp/products/prod-uuid.jpg"
}
```

**Response 404:**
```json
{"detail": "Barcode not found", "code": "NOT_FOUND", "barcode": "4607004530091"}
```

---

## 4. Stock Availability — sotuv oldidan tekshirish

### POST /warehouse/stock-check

POS sotuv tasdiqlashdan oldin real-time qoldiq tekshiradi.

**Request:**
```json
{
  "warehouse_id": 3,
  "items": [
    {"product_id": "prod-uuid-1", "quantity": 2.0},
    {"product_id": "prod-uuid-2", "quantity": 1.0}
  ]
}
```

**Response 200:**
```json
{
  "available": true,
  "items": [
    {
      "product_id": "prod-uuid-1",
      "requested": 2.0,
      "available_qty": 15.5,
      "sufficient": true
    },
    {
      "product_id": "prod-uuid-2",
      "requested": 1.0,
      "available_qty": 0.0,
      "sufficient": false
    }
  ]
}
```

**Agar `available: false`** bo'lsa POS sotuvni to'sib qo'yishi KERAK.

---

## 5. Sale Submission — POS sotuv ERP'ga yuborish

### POST /sale/pos-sales

**Headers:** `Idempotency-Key: {uuid}` — SHART (offline case uchun)

**Request:**
```json
{
  "cashbox_id": 2,
  "warehouse_id": 3,
  "customer_id": "cust-uuid",
  "sale_date": "2026-09-05T14:30:00+05:00",
  "currency_id": 1,
  "rate": 1.0,
  "items": [
    {
      "product_id": "prod-uuid-1",
      "quantity": 2.0,
      "price": 8500.00,
      "discount": 0.00,
      "barcode_used": "4607004530091"
    }
  ],
  "payments": [
    {"payment_type_id": 1, "amount": 17000.00},
    {"payment_type_id": 3, "amount": 0.00}
  ],
  "discount_amount": 0.00,
  "notes": "Stolovaya sale",
  "device_id": "POS-DEVICE-001"
}
```

**Response 201:**
```json
{
  "sale_id": "sale-uuid",
  "doc_number": "S-2026-004521",
  "status": "confirmed",
  "total_amount": 17000.00,
  "paid_amount": 17000.00,
  "change_amount": 0.00,
  "receipt_url": "https://cdn.aniq.erp/receipts/sale-uuid.pdf"
}
```

**Response 422 (yetarli qoldiq yo'q):**
```json
{
  "detail": "Insufficient stock for product Pepsi 0.5L",
  "code": "INSUFFICIENT_STOCK",
  "product_id": "prod-uuid-1",
  "requested": 2.0,
  "available": 0.5
}
```

**Response 409 (dublikat Idempotency-Key):**
```json
{
  "detail": "Duplicate sale",
  "code": "DUPLICATE",
  "existing_sale_id": "sale-uuid-prev"
}
```

---

## 6. Return Submission — POS qaytarish ERP'ga yuborish

### POST /sale/pos-returns

**Headers:** `Idempotency-Key: {uuid}` — SHART

**Request:**
```json
{
  "sale_id": "sale-uuid",
  "cashbox_id": 2,
  "warehouse_id": 3,
  "reason_id": 5,
  "reason": "Tovar sifatsiz chiqdi",
  "return_date": "2026-09-05T15:00:00+05:00",
  "items": [
    {
      "product_id": "prod-uuid-1",
      "quantity": 1.0,
      "price": 8500.00
    }
  ],
  "payments": [
    {"payment_type_id": 1, "amount": 8500.00}
  ]
}
```

**Response 201:**
```json
{
  "return_id": "return-uuid",
  "doc_number": "SR-2026-001234",
  "status": "completed",
  "total_amount": 8500.00,
  "refunded_amount": 8500.00
}
```

**Response 404 (asl sotuv topilmadi):**
```json
{"detail": "Original sale not found", "code": "NOT_FOUND"}
```

---

## 7. Offline Queue Sync — POS offline paytda yig'ilgan operatsiyalar

POS tarmoq qaytganda offline vaqtida yig'ilgan savdolarni toplu yuboradi.

### POST /sale/pos-sync

**Request:**
```json
{
  "device_id": "POS-DEVICE-001",
  "offline_from": "2026-09-05T10:00:00+05:00",
  "offline_to": "2026-09-05T11:30:00+05:00",
  "sales": [
    {
      "idempotency_key": "uuid-1",
      "cashbox_id": 2,
      "warehouse_id": 3,
      "sale_date": "2026-09-05T10:15:00+05:00",
      "items": [...],
      "payments": [...],
      "total_amount": 25000.00
    },
    {
      "idempotency_key": "uuid-2",
      "...": "..."
    }
  ]
}
```

**Response 200:**
```json
{
  "processed": 2,
  "results": [
    {
      "idempotency_key": "uuid-1",
      "status": "created",
      "sale_id": "sale-uuid-1",
      "doc_number": "S-2026-004522"
    },
    {
      "idempotency_key": "uuid-2",
      "status": "duplicate",
      "existing_sale_id": "sale-uuid-prev"
    }
  ],
  "failed": 0
}
```

**Eslatma:** Har element `idempotency_key` bilan idempotent tekshiriladi. Yetarli qoldiq bo'lmagan savdolar `status: "failed"` bilan qaytariladi.

---

## 8. Webhook Events — ERP → POS push xabarlar

ERP mahsulot, narx, qoldiq o'zgarganda POS qurilmalarni xabardor qiladi.

### Webhook konfiguratsiya

```
POST /settings/pos-webhooks
{
  "device_id": "POS-DEVICE-001",
  "webhook_url": "https://pos-local:8080/webhook",
  "events": ["product.updated", "price.updated", "stock.adjusted"]
}
```

### Event: `product.updated`

```json
{
  "event": "product.updated",
  "organization_id": "org-uuid",
  "timestamp": "2026-09-05T14:00:00Z",
  "data": {
    "product_id": "prod-uuid",
    "name": "Pepsi 0.5L (yangilangan)",
    "sale_price": 9000.00,
    "is_active": true,
    "updated_fields": ["name", "sale_price"]
  }
}
```

### Event: `price.updated`

```json
{
  "event": "price.updated",
  "organization_id": "org-uuid",
  "timestamp": "2026-09-05T14:00:00Z",
  "data": {
    "product_id": "prod-uuid",
    "old_price": 8500.00,
    "new_price": 9000.00,
    "effective_from": "2026-09-06T00:00:00Z"
  }
}
```

### Event: `stock.adjusted`

```json
{
  "event": "stock.adjusted",
  "organization_id": "org-uuid",
  "timestamp": "2026-09-05T14:00:00Z",
  "data": {
    "warehouse_id": 3,
    "product_id": "prod-uuid",
    "new_quantity": 8.5,
    "reason": "inventory_adjust"
  }
}
```

**POS webhook qabul qilganda:**
- 200 qaytarilsa — ERP delivery confirmed deb hisoblaydi
- 5xx yoki timeout — ERP 3 marta retry qiladi (1min, 5min, 30min)

---

## 9. Service Account (masin-masin auth)

POS qurilmalari xodim tizimga kirmasdan ham ishlashi uchun service account:

### POST /auth/pos-device-token

**Request:**
```json
{
  "device_key": "sk_live_xxxx",
  "device_id": "POS-DEVICE-001"
}
```

**Response 200:**
```json
{
  "access_token": "eyJ...",
  "expires_in": 86400,
  "scope": ["sale.create", "warehouse.view", "product.view"]
}
```

`device_key` — Settings → Qurilmalar bo'limida generatsiya qilinadi, ERP'ning `devices` jadvalida saqlanadi.

---

## 10. POS uchun cashbox session (smena)

### POST /finance/cashbox-sessions

```json
{
  "cashbox_id": 2,
  "opening_balance": 50000.00,
  "notes": "Ertalabki smena"
}
```

**Response 201:**
```json
{
  "session_id": "session-uuid",
  "cashbox_id": 2,
  "opened_at": "2026-09-05T08:00:00+05:00",
  "opening_balance": 50000.00,
  "status": "open"
}
```

### POST /finance/cashbox-sessions/{id}/close

```json
{
  "actual_balance": 285000.00,
  "notes": "Kechki smena yopildi"
}
```

**Response 200:**
```json
{
  "session_id": "session-uuid",
  "status": "closed",
  "closed_at": "2026-09-05T22:00:00+05:00",
  "total_income": 250000.00,
  "total_expense": 15000.00,
  "sale_count": 47,
  "closing_diff": 0.00
}
```

---

## API versioning va backward compatibility

- Current version: `v1`
- Breaking changes yangi `v2` prefix bilan kiritiladi
- `v1` endpointlar kamida 6 oy qo'llab-quvvatlanadi
- Deprecated fieldlar `X-Deprecation-Notice` header bilan oldin ogohlantiriladi

---

## Implementatsiya ketma-ketligi (ERP tomon)

1. Sprint 5: T-202 (sale stock deduction) — `POST /sale/pos-sales` haqiqatan stock kamaytiradi
2. Sprint 5: T-200 (stock_movements) — barcha harakatlar jurnalga tushadi
3. Sprint 6: `GET /warehouse/stock-check` — real-time qoldiq tekshirish
4. Sprint 6: `GET /warehouse/barcode-lookup` multi-barcode (T-201 asosida)
5. Sprint 7: `POST /sale/pos-sync` — offline queue
6. Sprint 7: Webhook infrastructure
