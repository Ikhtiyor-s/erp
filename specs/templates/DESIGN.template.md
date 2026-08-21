# DESIGN — <feature name>

> Architect tomonidan yoziladi (SPEC.md tayyor bo'lgandan keyin).
> Bu API kontrakt + fayl tuzilishi + DB o'zgarishlarni **muzlatadi** — keyingi parallel ish uchun.

## Yondashuv (1 abzats)

Tanlangan approach + nega + rad etilgan alternativalar.

> Misol: "Mavjud `products` jadvalga `mxik VARCHAR(20)` ustun qo'shamiz. Yangi jadval yaratish overkill — MXIK product-bound, alohida lifecycle yo'q. Optional qoldiramiz — backfill talab qilmaydi. Rad etildi: alohida `product_codes` jadvali (premature normalization), enum (MXIK code dynamic Soliq registry'da yangilanadi)."

## Fayl tuzilishi

### Yangi fayllar
- (yo'q — barcha o'zgarish mavjud fayllarda)

### Edit qilinadigan fayllar
- `apps/api/app/db/schema_patches.py` (+5 lines)
- `apps/api/app/modules/warehouse/router.py` (+10 lines — Pydantic schema)
- `apps/web/app/(dashboard)/warehouse/products/page.tsx` (+15 lines — input field)

## DB o'zgarishlari

```sql
-- schema_patches.py PATCHES list oxiriga
ALTER TABLE products ADD COLUMN IF NOT EXISTS mxik VARCHAR(20);

-- Optional indeks (faqat mxik-ga search bo'lsa kerak)
CREATE INDEX IF NOT EXISTS idx_products_mxik
    ON products (mxik) WHERE mxik IS NOT NULL;
```

**Migration safety**: ADD COLUMN NULLABLE → instant lock-free (PG 11+). Rollback: NULL qiymatlar saqlanadi.

## API kontrakti (FREEZE — backend va frontend parallel ishlash uchun)

### POST /api/v1/warehouse/products (mavjud, kengaytirish)

**Request body** (Pydantic `ProductCreate`):
```python
class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    sku: str | None = None
    barcode: str | None = None
    mxik: str | None = Field(None, min_length=10, max_length=20, pattern=r"^\d+$")
    sale_price: Decimal
    # ... mavjud field'lar
```

**Response 201**:
```json
{
  "id": "uuid",
  "name": "string",
  "sku": "string | null",
  "mxik": "string | null",
  "...": "..."
}
```

**Errors**:
- `422` — validation (mxik formati noto'g'ri)
- `409` — duplicate sku within org (mavjud)

### GET /api/v1/warehouse/products

Response item'larida `mxik` field qo'shildi (null bo'lsa ham). Filtering uchun query param qo'shilmaydi (out-of-scope).

## RBAC

| Endpoint | Permission code | Action | Mavjud? |
|---|---|---|---|
| POST /warehouse/products | `warehouse.create` | create | ✓ mavjud |
| PUT /warehouse/products/{id} | `warehouse.update` | update | ✓ mavjud |
| GET /warehouse/products | `warehouse.view` | view | ✓ mavjud |

**Yangi permission shart EMAS.**

## Frontend

### Product form (`apps/web/app/(dashboard)/warehouse/products/page.tsx`)

Yangi field SKU dan keyin:

```tsx
<Field label="MXIK kod" hint="10-20 raqam, Soliq qo'mitasi reestri">
  <input
    type="text"
    className={input}
    value={form.mxik || ""}
    onChange={(e) => setForm({ ...form, mxik: e.target.value.replace(/\D/g, "").slice(0, 20) })}
    placeholder="0902103000"
    inputMode="numeric"
    pattern="\d{10,20}"
  />
</Field>
```

### Product table

Yangi column SKU dan keyin (faqat desktop):
```tsx
<th>MXIK</th>
// ...
<td className="font-mono text-xs">{p.mxik || "—"}</td>
```

Mobile card layout'da: ikinchi qatorda kichik badge sifatida.

## Xavfsizlik

- **Trifecta risk**: yo'q. MXIK reference code, sir emas
- **Audit log**: avtomatik (mavjud middleware) — `mxik` SENSITIVE_KEYS'da emas
- **Validation**: client + server, regex `^\d{10,20}$`

## Tests (acceptance)

- Backend pytest: `test_products.py::test_create_with_mxik`, `test_create_invalid_mxik`, `test_cross_tenant_isolation`
- Frontend: manual smoke (form fill → submit → table row)

## Kontrakt MUZLATILDI ✓

Backend va frontend parallel ishlashi mumkin — yuqoridagi API shakli o'zgarmaydi.
