# DESIGN — MXIK field mahsulot jadvaliga qo'shish (2026-06-29)

> Architect tomonidan yoziladi. API kontrakt MUZLATILDI — backend va frontend parallel ishlashi uchun.

## Yondashuv (1 abzats)

Mavjud `products` jadvalga `mxik VARCHAR(20) NULL` ustunini qo'shamiz va mavjud `ProductIn`
Pydantic modeliga `mxik: str | None = None` fieldini `Field` validator bilan kengaytiramiz
(pattern `^\d{10,17}$`). Yangi jadval yoki alohida endpoint yaratmaydi — MXIK product-bound,
alohida lifecycle yo'q va hozircha search kerak emas. Schema patch `schema_patches.py` PATCHES
listiga oxiridan qo'shiladi — loyiha konvensiyasi shu (`IF NOT EXISTS` bilan idempotent).
Rad etildi: alohida `product_codes` jadvali (premature normalization — MXIK bitta qiymat, not
multi-valued); alembic migration (hozirgi tezkor fix uchun schema_patches yetarli, alembic
production uchun keyingi fursatga); enum type (MXIK Soliq qo'mitasi registrida yangilanadi,
hardcode xavfli). Existing pattern: `apps/api/app/db/schema_patches.py:335` da
`ALTER TABLE products ADD COLUMN IF NOT EXISTS kind VARCHAR(20)` aynan shu uslub.

## Fayl tuzilishi

### Yangi fayllar

- `apps/api/tests/test_products_mxik.py` — standalone test fayl (T-3 tayinlandi bu nomga;
  mavjud `test_warehouse.py` dan ajratib olinadi, chunki izolyatsiyalangan fixture set kerak)

### Edit qilinadigan fayllar

- `apps/api/app/db/schema_patches.py` — PATCHES list oxiriga 1 ta `ALTER TABLE` patch qo'shiladi
- `apps/api/app/modules/warehouse/router.py` — `ProductIn` Pydantic modeliga `mxik` field +
  `_product_params()` helperga `mxik` qo'shiladi + `_PRODUCT_FIELDS` string kengaytiriladi +
  `list_products` SQL SELECT'ga `p.mxik` qo'shiladi + `create_product` INSERT'ga `mxik` qo'shiladi
- `apps/web/app/(dashboard)/warehouse/products/page.tsx` — `Product` type'ga `mxik` field,
  `empty` state'ga `mxik: ""`, `save()` payload'ga `mxik` (null mapping), table columns'ga
  MXIK ustuni, modal form'ga MXIK input field, edit loader'ga `mxik: d.mxik || ""`
- `apps/web/i18n/messages/uz.json` — `"mxik"` va `"mxik_placeholder"` kalitlari
- `apps/web/i18n/messages/ru.json` — `"mxik"` va `"mxik_placeholder"` kalitlari
- `apps/web/i18n/messages/en.json` — `"mxik"` va `"mxik_placeholder"` kalitlari
- `apps/web/i18n/messages/uz-cyrl.json` — `"mxik"` va `"mxik_placeholder"` kalitlari

## DB o'zgarishlari

```sql
-- apps/api/app/db/schema_patches.py PATCHES list oxiriga qo'shiladi (hozir 909-qatordan keyin)
"""ALTER TABLE products ADD COLUMN IF NOT EXISTS mxik VARCHAR(20)"""
```

**Migration safety:**
- `ADD COLUMN ... NULL` — PostgreSQL 11+ da instant, lock-free DDL. Table rewrite yo'q.
- `IF NOT EXISTS` — idempotent, ikki marta restart qilsa xato bermaydi.
- Rollback: `ALTER TABLE products DROP COLUMN IF EXISTS mxik;` — nullable bo'lgani uchun
  mavjud qatorlarga ta'sir yo'q.
- **Indeks shart emas** (SPEC talabi: MXIK bo'yicha search bu sprintda yo'q — keyingi sprint).
  `idx_products_parent` pattern (see `schema_patches.py:414`) — keyinchalik shu shaklda qo'shiladi.

## API kontrakti (FREEZE)

> Backend va frontend bu kontraktga tayanib parallel ishlaydi. O'zgarmaydi.

### Kengaytirilgan endpoint: POST /api/v1/warehouse/products

Pattern: `apps/api/app/modules/warehouse/router.py:192-329` — `ProductIn` model + `create_product`
handler. Shu structura'ga `mxik` qo'shiladi.

**Request body — `ProductIn` Pydantic model (mavjud, kengaytiriladi):**

```python
# apps/api/app/modules/warehouse/router.py:192 dan keyin
mxik: str | None = Field(
    default=None,
    pattern=r"^\d{10,17}$",
    description="MXIK (Mahsulot va Xizmatlar Identifikatsiya Kodi) — 10-17 raqam",
)
```

`Field(pattern=...)` Pydantic 2 da regex validatsiyasi — `pattern` arg to'g'ridan-to'g'ri
`str` ga ishlatiladi. `min_length`/`max_length` emas — regex yetarli (pattern ham uzunlik
chegaralaydi). `null` qabul qilinadi (field optional).

**Maqbul qiymatlar:**
| Qiymat | Natija |
|---|---|
| `"0902103000"` (10 raqam) | 201 OK |
| `"12345678901234567"` (17 raqam) | 201 OK |
| `null` / field yo'q | 201 OK, response'da `"mxik": null` |
| `"123"` (3 raqam) | 422 Unprocessable Entity |
| `"123456789012345678"` (18 raqam) | 422 Unprocessable Entity |
| `"ABC1234567"` (harfli) | 422 Unprocessable Entity |

**Response 201 (POST create):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000"
}
```

Hozirgi create endpoint faqat `{"id": str(pid)}` qaytaradi (see `router.py:329`). Bu
sprintda o'zgarmaydi — response minimal qoladi. MXIK `GET /products` va
`GET /products/{pid}/full` orqali ko'rinadi.

---

### Kengaytirilgan endpoint: PUT /api/v1/warehouse/products/{pid}

Pattern: `apps/api/app/modules/warehouse/router.py:332-348` — `update_product` handler.
`ProductIn` model o'zgarishi avtomatik tashiydi.

**Response 200:**

```json
{
  "ok": true
}
```

---

### Kengaytirilgan endpoint: GET /api/v1/warehouse/products

Pattern: `apps/api/app/modules/warehouse/router.py:221-262` — `list_products` handler.

**Response 200 — array elementida yangi field:**

```json
[
  {
    "id": "uuid",
    "sku": "string | null",
    "barcode": "string | null",
    "name": "string",
    "mxik": "string | null",
    "sale_price": "numeric string",
    "purchase_price": "numeric string",
    "currency_id": "int | null",
    "currency_code": "string | null",
    "unit_id": "int | null",
    "unit_name": "string | null",
    "category_id": "int | null",
    "category_name": "string | null",
    "is_service": "bool",
    "is_produced": "bool | null",
    "total_stock": "numeric string"
  }
]
```

SQL o'zgarishi: `SELECT p.id, p.sku, p.barcode, p.name, **p.mxik**, ...` — `list_products`
SQL query'ga `p.mxik` qo'shiladi (see `router.py:248-259`).

---

### Kengaytirilgan endpoint: GET /api/v1/warehouse/products/{pid}/full

Pattern: `apps/api/app/modules/warehouse/router.py:351-388` — `product_full` handler.
`SELECT p.*` ishlatilgani uchun (`router.py:357`) yangi ustun avtomatik chiqadi — qo'shimcha
o'zgartirish kerak emas.

**Response 200 — `mxik` field avtomatik mavjud bo'ladi** (`SELECT p.*` tufayli).

---

### Xato kodlari (barcha endpoint uchun umumiy)

| HTTP kodi | Holat | Body shape |
|---|---|---|
| `422` | Validation error (mxik formati noto'g'ri) | `{"detail": [{"loc": ["body", "mxik"], "msg": "...", "type": "string_pattern_mismatch"}]}` |
| `404` | Product topilmadi (yoki boshqa org) | `{"detail": "Not Found"}` |
| `401` | JWT yo'q yoki eskirgan | `{"detail": "Not authenticated"}` |
| `403` | Permission yo'q | `{"detail": "Permission denied: warehouse.create"}` |

---

### `_product_params()` helper o'zgarishi

`apps/api/app/modules/warehouse/router.py:275-285` — `_product_params()` ga `"mxik": p.mxik`
qo'shiladi.

### `_PRODUCT_FIELDS` string o'zgarishi

`apps/api/app/modules/warehouse/router.py:265-273` — `_PRODUCT_FIELDS` string'ga
`, mxik=:mxik` qo'shiladi (UPDATE uchun).

### INSERT o'zgarishi (create_product)

`apps/api/app/modules/warehouse/router.py:318-325` — INSERT column listiga `mxik` va VALUES
listiga `:mxik` qo'shiladi.

## RBAC

| Endpoint | Permission kodi | Mavjud? |
|---|---|---|
| `POST /warehouse/products` | `warehouse.create` | Mavjud (`permissions.py:33`) |
| `PUT /warehouse/products/{id}` | `warehouse.update` | Mavjud (`permissions.py:33`) |
| `GET /warehouse/products` | `warehouse.view` | Mavjud (`permissions.py:33`) |
| `GET /warehouse/products/{id}/full` | `warehouse.view` | Mavjud (`permissions.py:33`) |

**Yangi permission shart emas.** `MXIK` field mavjud product create/update operatsiyalarining
bir qismi — alohida ruxsat kerak emas.

## Frontend kontrakti

### `Product` TypeScript type kengaytmasi

`apps/web/app/(dashboard)/warehouse/products/page.tsx:14-30` — `Product` type'ga qo'shiladi:

```typescript
mxik?: string | null;
```

### `empty` state kengaytmasi

`apps/web/app/(dashboard)/warehouse/products/page.tsx:33-57` — `empty` objectga qo'shiladi:

```typescript
mxik: "",
```

### `save()` payload kengaytmasi

`apps/web/app/(dashboard)/warehouse/products/page.tsx:104-118` — `payload` objectga:

```typescript
mxik: form.mxik?.trim() || null,
```

Bo'sh string `null` ga aylantiriladi — server optional field sifatida qabul qiladi.

**Muhim**: `save()` funksiyasida hozir `toast.error(e?.response?.data?.detail || "Xato")`
ishlatilgan (`router.py:125` ga mos `page.tsx:125`). CLAUDE.md konvensiyasiga ko'ra bu
`toast.error(getErrorMessage(e, "MXIK xato"))` ko'rinishida to'g'irlanishi kerak. Bu
`getErrorMessage` import qo'shishni talab qiladi: `import { getErrorMessage } from "@/lib/api-error"`.

**Muhim 2**: `del()` funksiyasida `confirm(...)` ishlatilgan (`page.tsx:129`) — CLAUDE.md
anti-pattern. T-2 frontend-dev `ConfirmDialog` ga o'tkazadi.

### Table column qo'shilishi

`apps/web/app/(dashboard)/warehouse/products/page.tsx:135-152` — `columns` arrayiga
barcode dan keyin:

```typescript
{
  key: "mxik",
  header: "MXIK",
  width: "130px",
  render: (r) => (
    <span className="font-mono text-xs">{r.mxik || "—"}</span>
  )
}
```

Desktop table (`<DataTable>`) da ko'rinadi. Mobile card pattern (`md:hidden`) uchun
mavjud `DataTable` komponentining mobile render'i ishlatiladi — alohida markup kerak emas
agar `DataTable` o'zi handle qilsa. Agar `DataTable` mobile cards render qilmasa,
`apps/web/app/(dashboard)/admin/users/page.tsx` patternini qo'llash kerak.

### Modal form — MXIK input field

`apps/web/app/(dashboard)/warehouse/products/page.tsx:230-237` — SKU fielddan
(`page.tsx:230`) keyin qo'shiladi:

```typescript
<Field label="MXIK kod">
  <input
    className={input}
    inputMode="numeric"
    placeholder="Masalan: 0902103000"
    value={form.mxik || ""}
    onChange={(e) =>
      setForm({ ...form, mxik: e.target.value.replace(/\D/g, "").slice(0, 17) })
    }
  />
</Field>
```

`inputMode="numeric"` — mobil klaviatura optimizatsiyasi. `.replace(/\D/g, "")` client-side
digit-only filter (server ham validatsiya qiladi). `.slice(0, 17)` — max 17 belgi.

### Edit loader — mxik qiymati yuklash

`apps/web/app/(dashboard)/warehouse/products/page.tsx:192-208` — full load blokiga:

```typescript
mxik: d.mxik || "",
```

### i18n kalitlari (4 til)

Har bir `apps/web/i18n/messages/*.json` faylida `"warehouse"` yoki tegishli namespace'ga:

```json
"mxik": "MXIK kod",
"mxik_placeholder": "Masalan: 0902103000"
```

| Fayl | `mxik` qiymati | `mxik_placeholder` qiymati |
|---|---|---|
| `uz.json` | `"MXIK kod"` | `"Masalan: 0902103000"` |
| `ru.json` | `"Код МХИК"` | `"Например: 0902103000"` |
| `en.json` | `"MXIK code"` | `"Example: 0902103000"` |
| `uz-cyrl.json` | `"МХИК коди"` | `"Масалан: 0902103000"` |

Hozirgi products page `useTranslations("ui")` namespace ishlatadi (`page.tsx:63`).
Yangi kalitlar `ui` namespace'ga qo'shiladi.

## Xavfsizlik

- **Trifecta risk: yo'q.** MXIK — O'zbekiston Soliq qo'mitasining ommaviy ma'lumotnoma kodi.
  Sir emas, redact kerak emas.
- **Audit log**: `apps/api/app/modules/audit/middleware.py:62-68` — `SENSITIVE_KEYS`'ga
  `mxik` qo'shilmaydi. Audit middleware avtomatik `POST /warehouse/products` va
  `PUT /warehouse/products/{id}` loglarini yozadi — MXIK qiymati ochiq ko'rinishi kerak.
- **Cross-tenant izolyatsiya**: `list_products` (`router.py:232`), `product_full`
  (`router.py:362`), `update_product` (`router.py:339`) — barchasi `WHERE organization_id = :o`
  filtridan o'tadi. MXIK bu filtrni o'zgartirmaydi.
- **SQL injection**: `mxik` qiymati `_product_params()` orqali bound parameter `:mxik`
  sifatida uzatiladi — f-string interpolation yo'q (CLAUDE.md konvensiyasiga mos).
- **Pydantic validatsiya**: `pattern=r"^\d{10,17}$"` — server-side mandatory. Client-side
  `.replace(/\D/g, "")` qo'shimcha UX.

## Testlar (T-3 uchun acceptance blueprint)

Yangi fayl: `apps/api/tests/test_products_mxik.py`

Mavjud test pattern: `apps/api/tests/` da fixture uslubi uchun qaralsin.

| Test funksiyasi | Assert |
|---|---|
| `test_valid_mxik_create` | mxik="0902103000" → 201, response id mavjud |
| `test_valid_mxik_max_length` | mxik="12345678901234567" (17) → 201 |
| `test_valid_mxik_null` | mxik=None → 201, GET response'da mxik null |
| `test_invalid_mxik_too_short` | mxik="123" → 422 |
| `test_invalid_mxik_too_long` | mxik="123456789012345678" (18) → 422 |
| `test_invalid_mxik_non_digit` | mxik="ABC1234567" → 422 |
| `test_cross_tenant_mxik_isolation` | Org B product id → Org A token bilan GET → 404 |
| `test_update_mxik` | PUT bilan mxik yangilash → 200, GET orqali yangi qiymat tasdiqlash |

## Kontrakt MUZLATILDI

| Endpoint | Method | Request field | Response field | Status |
|---|---|---|---|---|
| `/api/v1/warehouse/products` | POST | `mxik: str \| null` (pattern `^\d{10,17}$`) | `{"id": "uuid"}` | FROZEN |
| `/api/v1/warehouse/products/{id}` | PUT | `mxik: str \| null` (same pattern) | `{"ok": true}` | FROZEN |
| `/api/v1/warehouse/products` | GET | — | each item: `mxik: string \| null` | FROZEN |
| `/api/v1/warehouse/products/{id}/full` | GET | — | `mxik: string \| null` (via `SELECT p.*`) | FROZEN |

Backend va frontend parallel ishlashi mumkin — yuqoridagi API shakli o'zgarmaydi.
