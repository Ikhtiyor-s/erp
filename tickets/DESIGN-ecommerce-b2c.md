# DESIGN — Ecommerce: B2C Public Storefront (EC-9)

> Architect tomonidan yoziladi. Spec: `tickets/SPEC-ecommerce-b2c.md`.
> Bu hujjat **FREEZE** — pastdagi API shakli, fayl joylashuvi va `sale/service.py`
> kontrakti o'zgarmaydi. `tickets/DESIGN-ecommerce-b2b-pricing.md` xuddi shu
> `sale/service.py` qarorini so'zma-so'z qaytaradi — ikkala tomon (EC-3, EC-6)
> bir xil kontraktga quriladi.

## Yondashuv (1 abzats)

Yangi public (anonim) savdo yuzasi — `storefront` nomli ALOHIDA modul, `customer_portal`ga
QO'SHILMAYDI. Sabab: auth modeli tubdan farqli (OTP+JWT bilan tanilgan mijoz vs umuman
auth yo'q anonim mehmon) — bitta routerga aralashtirish har bir endpointda "bu chaqiruv
authenticated-mi yo'qmi" degan shartli tarmoqlanishni keltirib chiqaradi va ichki ma'lumot
sizib chiqish xavfini oshiradi (masalan `customer_portal`da ishlatiladigan `products`
so'rovi hech qachon `purchase_price`ni filtrlamaydi, chunki authenticated xodim/mijoz uchun
yozilgan; shu kodni anonim yo'lga qo'shib yuborish — xavfli). Ikkinchi, kattaroq qaror:
`sale/router.py`dagi `create_sale()` yadrosi `apps/api/app/modules/sale/service.py`ga
(yangi fayl — bugun mavjud emas) chiqariladi: `create_sale_core()` deb nomlangan yagona
funksiya ichki `/sale/sales`, B2B (`EC-3`, `customer_portal`) va B2C (`EC-6`, `storefront`)
tomonidan bir xil shaklda chaqiriladi. Narx hisoblash (segment/shartnoma/standart) BU
funksiya ICHIDA emas — har bir chaqiruvchi narxni oldindan hal qilib, tayyor `price` bilan
keladi (ichki `/sale/sales` — xodim qo'lda kiritadi; B2B — `customer.pricing` moduli hal
qiladi; B2C — har doim `products.sale_price`, override yo'q, mehmon segmentga tegishli emas).

Rad etilgan alternativalar:
- **`customer_portal`ga qo'shish** — rad etildi (yuqorida sabab).
- **`create_sale()`ni umuman chiqarmaslik, B2B/B2C o'zini sale_items'ga to'g'ridan-to'g'ri
  yozishi** — rad etildi: stock-deduct + accounting-posting + BOM pick bootstrap ~80 qatorlik
  murakkab, xatoga moyil logika; ikki marta yozish = ikki marta xato qilish xavfi.
- **Guest-customer uchun yangi `guest_customers` jadvali (customers'dan alohida)** — rad
  etildi: `sales.customer_id` allaqachon `customers(id)`ga FK; alohida jadval checkout'ni
  ikki turga ajratib, `/me/sales`, `/customer/customers/{id}` kabi mavjud mijoz-profil
  sahifalarini B2C xaridorlar uchun ishlamay qoldiradi. Oddiy `customers` qatori (bo'sh
  `category_id`, demak narx override yo'q) to'g'ri yechim.
- **Stock-race uchun alohida `stock_reservations` qatlami** — rad etildi, pastda (d)da
  asoslab berilgan: mavjud `_stock_apply`'dagi `SELECT ... FOR UPDATE` qulf yetarli.

## Fayl tuzilishi

### Yangi fayllar
- `apps/api/app/modules/sale/service.py` — `create_sale_core()`, `verify_warehouse_in_org()`,
  `verify_products_in_org()`, `get_online_warehouse_id()`, `SaleLineInput`, `SaleCreateResult`
  (barcha — EC-3 va EC-6 ikkisi ham shu yerdan import qiladi)
- `apps/api/app/modules/storefront/__init__.py`
- `apps/api/app/modules/storefront/router.py` — `GET /shop/products`, `GET /shop/categories`,
  `POST /shop/checkout` (prefix `/shop`, modul nomi `storefront`)
- `apps/api/app/modules/storefront/service.py` — `resolve_org_by_code()`,
  `find_or_create_guest_customer()`, `get_catalog()` (EC-5 bu yerga to'ldiradi)
- `apps/web/app/(shop)/...` — EC-8 qamrovi, bu DESIGN joylashuvni belgilaydi, ichini to'ldirmaydi

### Edit qilinadigan fayllar
- `apps/api/app/modules/sale/router.py` — `create_sale()` ichidagi stock+accounting logika
  olib tashlanadi, o'rniga `service.create_sale_core()` chaqiriladi (javob shakli
  o'zgarmaydi: `{"id": ..., "total_amount": ...}`); `_verify_warehouse_in_org`,
  `_verify_products_in_org`, `_bootstrap_pick_items` service.py'dan import qilinadi
  (eski nomlar — endi underscore'siz, service.py'da public)
- `apps/api/app/db/schema_patches.py` — pastdagi DDL
- `apps/api/app/main.py` — `app.include_router(storefront_router, prefix=API_PREFIX)` (+1 qator)
- `apps/api/app/modules/rbac/middleware.py` — `SKIP_PATHS_PREFIX`ga `"/api/v1/shop/"` qo'shiladi
  (himoya uchun aniq yozilgan — `URL_MODULE`da "shop" yo'qligi sabab allaqachon o'tkazib
  yuboriladi, lekin kelajakda "shop" shu dictga qo'shilib qolishiga qarshi himoya)
- `apps/api/app/modules/audit/middleware.py` — `SKIP_PATH_PREFIXES`ga
  `"/api/v1/shop/checkout"` qo'shiladi (`storefront/router.py` o'zi `log_action` chaqiradi,
  `org_code`dan chiqqan to'g'ri `org_id` bilan — avtomatik audit `X-Organization-Id`
  header'siz so'rovda `org_id=NULL` yozib qo'yardi)
- `apps/api/app/modules/warehouse/router.py` — `ProductIn` + create/update: `is_published_online: bool = False`
- `apps/api/app/modules/warehouse/service.py` — `get_products_paginated()` SELECT ro'yxatiga
  `p.is_published_online` qo'shiladi (admin jadvalida ko'rsatish uchun)
- `apps/web/app/(dashboard)/warehouse/products/page.tsx` — checkbox + jadval ustuni (pastda)
- **Yangi** `apps/web/app/(dashboard)/settings/ecommerce/page.tsx` — mavjud
  `SettingsForm` komponentidan foydalanib, `online_warehouse_id` select maydoni
  (`settingsKey="ecommerce"`)

## DB o'zgarishlari

```sql
-- 1) Mahsulotni onlayn do'konga chiqarish belgisi
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_published_online BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_products_published_online
    ON products (organization_id, name)
    WHERE is_published_online = TRUE AND is_active = TRUE AND is_archived = FALSE;

-- 2) Mehmon-mijoz telefon bo'yicha qidirish (OTP flow'da ham, checkout dedup'da ham
--    ishlatiladigan aniq-moslik qidiruv uchun B-tree; mavjud GIN trigram ILIKE uchun,
--    bu esa exact-match uchun)
CREATE INDEX IF NOT EXISTS idx_customers_org_phone
    ON customers (organization_id, phone) WHERE phone IS NOT NULL;

-- 3) Storefront buyurtma metadata/navbat jadvali (customer_portal_orders bilan bir xil
--    naqsh: sale_id HAR DOIM to'ladi, chunki checkout har doim haqiqiy sales yaratadi —
--    shuning uchun NOT NULL, customer_portal_orders.sale_id'dan farqli, u retrofit bo'lgani
--    uchun nullable edi)
CREATE TABLE IF NOT EXISTS storefront_orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    sale_id         UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    customer_id     UUID NOT NULL REFERENCES customers(id),
    order_number    VARCHAR(50),
    status          VARCHAR(20) NOT NULL DEFAULT 'new',
        -- 'new' | 'confirmed' | 'cancelled' | 'delivered'
        -- (customer_portal_orders.PORTAL_ORDER_STATUSES bilan bir xil lug'at — staff bitta
        --  vocabulary o'rganadi)
    payment_mode    VARCHAR(20) NOT NULL DEFAULT 'manual',  -- 'manual' | 'gateway'
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_storefront_orders_sale ON storefront_orders(sale_id);
CREATE INDEX IF NOT EXISTS idx_storefront_orders_org_status
    ON storefront_orders(organization_id, status);
```

**Migration safety**: barcha `ADD COLUMN`/`CREATE TABLE IF NOT EXISTS`/`CREATE INDEX IF NOT
EXISTS` — lock-free, nullable yoki default bilan, idempotent (repo konvensiyasiga mos,
`CONCURRENTLY` ishlatilmaydi, chunki lifespan tranzaksiya ichida ishlaydi).

**Rollback**:
```sql
DROP TABLE IF EXISTS storefront_orders;
DROP INDEX IF EXISTS idx_customers_org_phone;
DROP INDEX IF EXISTS idx_products_published_online;
ALTER TABLE products DROP COLUMN IF EXISTS is_published_online;
```
`sales`/`sale_items`/`payment_transactions` — moliyaviy yozuv, hech qachon o'chirilmaydi
(SPEC'dagi rollback rejasiga mos).

**Qasddan qilinmagan narsa**: `customers.phone` ustiga UNIQUE constraint QO'YILMAYDI.
Mavjud ma'lumotlarda takrorlanган telefon bo'lishi mumkin (tekshirilmagan — bu
migration'ni xavfli qiladi); o'rniga dedup race-condition pastda (c)da advisory lock
orqali hal qilinadi, DB constraint shart emas.

## `sale/service.py` kontrakti — EC-3 va EC-6 ikkisi ham shu yerga quriladi (FREEZE)

```python
# apps/api/app/modules/sale/service.py
from dataclasses import dataclass, field
from decimal import Decimal

@dataclass
class SaleLineInput:
    product_id: str
    quantity: Decimal
    price: Decimal              # chaqiruvchi hal qiladi — bu funksiya narx bilmaydi
    discount: Decimal = Decimal("0")

@dataclass
class SaleCreateResult:
    sale_id: str
    total_amount: Decimal
    total_cost: Decimal

async def verify_warehouse_in_org(db, warehouse_id: int, org_id: str) -> None: ...
async def verify_products_in_org(db, product_ids: list[str], org_id: str) -> None: ...

async def get_online_warehouse_id(db, org_id: str) -> int | None:
    """app_settings[key='ecommerce'].value['online_warehouse_id'] — B2B portal va B2C
    storefront ikkisi ham SHU BITTA sozlamadan foydalanadi (ikki alohida sozlama emas)."""

async def create_sale_core(
    db,
    *,
    org_id: str,
    customer_id: str | None,
    warehouse_id: int,
    currency_id: int,
    rate: Decimal,
    items: list[SaleLineInput],
    notes: str | None,
    user_id: str | None,          # None = anonim/guest checkout (sales.created_by nullable)
    source_type: str = "sale",    # journal_entries.source_type / stock_movements.operation_type
                                   # default "sale" = bugungi ichki /sale/sales bilan bitta xil
                                   # qiymat (orqaga mos). B2B "sale_b2b_portal", B2C
                                   # "sale_storefront" uzatishi SHOULD — moliya bo'limi
                                   # journal browser'da kanal bo'yicha filtrlay oladi.
                                   # DIQQAT: sales/sale_items jadvaliga HECH QANDAY "channel"
                                   # ustuni QO'SHILMAYDI — dashboard/P&L sales jadvalidan
                                   # to'g'ridan-to'g'ri o'qiydi, source_type unga ta'sir qilmaydi.
) -> SaleCreateResult:
    """
    Ichida nima bo'ladi (bugungi create_sale() bilan BIR XIL tartib, faqat chiqarib olingan):
      1. verify_warehouse_in_org, verify_products_in_org — ICHIDA chaqiriladi (chaqiruvchi
         bu tekshiruvni takrorlashi SHART EMAS — xavfsizroq, "unutib qo'yish" xavfi yo'q)
      2. items bo'sh bo'lsa — 422
      3. items product_id bo'yicha SORT qilinadi (YANGI — pastda (d)da asoslangan)
      4. sales + har bir sale_item INSERT, unit_cost snapshot (FOR UPDATE), BOM explode,
         _stock_apply (stock yetarli bo'lmasa 422 — hech narsa commit qilinmagan, shuning
         uchun hammasi avtomatik bekor bo'ladi), order_pick_items bootstrap
      5. Accounting: Dr AR / Cr Revenue (+ Dr COGS / Cr Inventory) — post_journal_entry,
         best-effort try/except (bugungi xatti-harakat o'zgarmaydi: xato bo'lsa log qilinadi,
         sotuv bloklanmaydi)
      6. await db.commit()  — YAGONA commit chegarasi shu yerda
    Bu funksiya log_action() YOKI bildirishnoma (Telegram) CHAQIRMAYDI — bular chaqiruvchiga
    tegishli (har birida o'z diff shakli, o'z so'rov contexti bor). Chaqiruvchi
    create_sale_core() dan qaytgach o'zining log_action()/commit()ini qiladi (bugungi
    /sale/sales'dagi "ikkinchi commit, audit uchun" naqsh bilan bir xil).
    """
```

**Kim committing qiladi — aniq javob**: `create_sale_core()` ICHIDA bitta
`await db.commit()` chaqiradi (sale+items+stock+accounting — bir tranzaksiya). Chaqiruvchi
keyin O'ZINING metadata yozuvini (masalan `storefront_orders` yoki
`customer_portal_orders.sale_id`) yozadi va **o'z** `log_action()` + ikkinchi `commit()`ini
qiladi — xuddi bugungi `/sale/sales` ikki-commit naqshiga mos.

**(d) Stock-race himoyasi — qo'shimcha reservation qatlami KERAK EMAS.** Mavjud
`_stock_apply()` har safar `SELECT ... FOR UPDATE` bilan `stock_balances` qatorini
qulflaydi va shundan keyin manfiy qoldiqni tekshiradi — bu PostgreSQL darajasida ikkinchi
bir vaqtdagi tranzaksiyani birinchisi commit/rollback qilmaguncha BLOKLAYDI. Demak ikki
parallel checkout bir xil (warehouse,product) qatorga tegsa — ikkinchisi birinchisi
tugaguncha kutadi, keyin yangilangan qoldiqni ko'radi va kerak bo'lsa 422 oladi. Bu
to'liq "hammasi yoki hech narsa" kafolatini beradi, qo'shimcha `stock_reservations`
jadvali ortiqcha murakkablik (checkout bir martalik amal, "savatni ushlab turish" muddati
yo'q — reservation faqat TTL/expiry boshqarish og'irligini qo'shardi, foyda bermasdan).
Yagona YANGI tavsiya: `create_sale_core()` har bir checkout ichida `items` ro'yxatini
`product_id` bo'yicha SORT qiladi — bu ikki ko'p-qatorli parallel checkout bir xil
tartibda qulflashini kafolatlab, deadlock ehtimolini yo'q qiladi (bugungi ichki
`/sale/sales` ham shu muammoga ochiq edi — bu tuzatish hammaga foyda beradi, faqat B2C
uchun emas).

## API kontrakti (FREEZE)

### `GET /api/v1/shop/categories?org_code=<code>`

Auth: **yo'q** (public). Rate-limit: `60/minute` (IP bo'yicha).

**Response 200**:
```json
{"items": [{"id": 3, "name": "Ichimliklar", "product_count": 12}]}
```
**Errors**: `404` — `org_code` topilmadi yoki `organizations.is_active=FALSE`.

### `GET /api/v1/shop/products?org_code=<code>&category_id=&q=&limit=&offset=`

Auth: **yo'q** (public). Rate-limit: `60/minute`.
To'liq filtr/sort richness — **EC-5 qamrovi**; quyidagi shakl EC-5 uchun FREEZE qilingan
minimal kontrakt, EC-5 orqaga-mos qo'shimcha query-param qo'sha oladi, lekin item shaklidan
MUTLAQO quyidagi maydonlarni OLIB TASHLAY OLMAYDI.

**Response 200**:
```json
{
  "configured": true,
  "items": [
    {
      "id": "uuid",
      "name": "Coca-Cola 1.5L",
      "category_id": 3,
      "category_name": "Ichimliklar",
      "image_url": "https://.../cola.jpg",
      "price": 18000.0,
      "currency_code": "UZS",
      "stock_status": "in_stock"
    }
  ],
  "total": 42
}
```
`stock_status` — `"in_stock" | "low" | "out_of_stock"` (threshold EC-5 belgilaydi).
`"configured": false` + `"items": []` — `online_warehouse_id` sozlanmagan bo'lsa (200,
hard-fail YO'Q — do'kon "vaqtincha yopiq" holatini ko'rsatadi, SPEC rollback rejasiga mos).

**MUST NOT**: javobda `purchase_price`, `avg_cost`, `cost`, yoki boshqa ichki moliyaviy
maydon — hech qachon, hech qaysi sharoitda.

**Errors**: `404` — org_code topilmadi.

### `POST /api/v1/shop/checkout`

Auth: **yo'q** (public). Rate-limit: `20/minute` (IP bo'yicha — savatni tez-tez
qayta yubormaslik uchun OTP'dan yumshoqroq, chunki bu bitta amal, OTP kabi ketma-ket
urinish emas).

**Request**:
```json
{
  "org_code": "DEMO1",
  "customer": {"name": "Aziz Karimov", "phone": "+998901234567"},
  "items": [{"product_id": "uuid", "quantity": 2}],
  "notes": "Kodirgoh, 3-eshik"
}
```
`items[].price` **QABUL QILINMAYDI** — agar klient yuborsa, FastAPI/Pydantic darajasida
rad etiladi (model'da field yo'q). Narx HAR DOIM serverda `products.sale_price`dan
olinadi — mehmon xaridorga segment/shartnoma override qo'llanmaydi (B2B pricing modeli
faqat tanilgan `customer_id`ga bog'liq, pastga qarang DESIGN-ecommerce-b2b-pricing.md).

**Response 201**:
```json
{
  "sale_id": "uuid",
  "order_number": "SF-2026-00042",
  "status": "payment_pending",
  "total_amount": 36000.0,
  "payment": {"mode": "manual", "provider": null, "payment_url": null}
}
```
`status` — doim `"payment_pending"` bu sprintda (haqiqiy `sales.status` ichida
`'confirmed'`, `paid_amount=0` — mavjud sale-status modeliga mos, SPEC Scenario 3/5 bilan
bir xil yondashuv B2B'dagidek). `payment.mode` — `"manual"` (hech qaysi provider enabled
emas, bugungi haqiqiy holat) yoki `"gateway"` (`online_payments.<provider>.enabled=true`
bo'lsa — `provider` kodi to'ladi, `payment_url` esa **EC-7 qamrovi**, hozircha har doim
`null` — bu maydonga keyin qiymat qo'shish orqaga-mos o'zgarish, kontraktni buzmaydi).

**Errors**:
- `404` — `org_code` topilmadi
- `422` — telefon formati noto'g'ri (`app.core.phone.normalize_phone` xatosi)
- `422` — `product_id` boshqa tashkilotga tegishli / arxivda / `is_published_online=FALSE`
- `422` — stock yetarli emas (xuddi `_stock_apply`'ning bugungi xabari:
  `"Insufficient stock: warehouse=... product=... on_hand=... requested=..."`) — frontend
  umumiy 422 `detail` string sifatida ko'rsatadi, maydon-bo'yicha xato emas (ichki
  `/sale/sales` bilan bir xil)
- `503` — `online_warehouse_id` sozlanmagan (do'kon konfiguratsiya xatosi, klient
  muammosi emas)
- `429` — rate limit

**(c) Guest-customer dedup — faqat TELEFON bo'yicha** (ism bo'yicha EMAS):
1. `phone = normalize_phone(customer.phone)` — xato bo'lsa 422.
2. `await db.execute("SELECT pg_advisory_xact_lock(hashtextextended(:k, 0))", {"k": f"{org_id}:{phone}"})`
   — tranzaksiya ichida, bir xil (org,phone) uchun parallel checkout'larni serializatsiya
   qiladi, commit/rollback'da avtomatik bo'shaydi, DB constraint SHART EMAS.
3. `SELECT id, name FROM customers WHERE organization_id=:o AND phone=:p LIMIT 1` —
   topilsa, **mavjud ism saqlanadi** (checkout'dagi `name` e'tiborga olinmaydi — mehmonning
   bir martalik yozuv xatosi haqiqiy mijoz nomini buzmasin).
4. Topilmasa — yangi `customers` qatori (`category_id=NULL`, standart narx, override yo'q).

## RBAC

| Endpoint | Permission code | Izoh |
|---|---|---|
| `GET /shop/*`, `POST /shop/checkout` | **YO'Q** — auth talab qilinmaydi | `"shop"` `URL_MODULE`da yo'q → `PermissionMiddleware` avtomatik o'tkazib yuboradi; `SKIP_PATHS_PREFIX`ga aniq yozuv ham qo'shiladi (himoyaviy) |
| `PUT /warehouse/products/{id}` (`is_published_online`) | `warehouse.update` | ✓ mavjud, yangi permission SHART EMAS |
| `PUT /settings/key/ecommerce` (`online_warehouse_id`) | `settings.update` | ✓ mavjud generic endpoint |
| `GET /customer/portal-orders`, staff'ning storefront navbatini ko'rish | — | **Out of scope** (pastga qarang) — bu sprintda `/customer/storefront-orders` staff-view endpoint YOZILMAYDI, faqat jadval yaratiladi. EC-7/EC-8 qamrovi. |

## Frontend

### `apps/web/app/(dashboard)/warehouse/products/page.tsx` — `is_published_online` checkbox

Mavjud `mxik` maydoni naqshiga mos (shu faylda allaqachon bor), SKU/MXIK checkbox
guruhlaridan keyin:

```tsx
<Field label={t("onlayn_dokonda_korsatish")}>
  <label className="flex items-center gap-2">
    <input
      type="checkbox"
      checked={form.is_published_online}
      onChange={(e) => setForm({ ...form, is_published_online: e.target.checked })}
    />
    <span className="text-xs text-ink-500">
      {t("onlayn_dokon_hint")} {/* "Belgilansa, /shop ommaviy katalogida ko'rinadi" */}
    </span>
  </label>
</Field>
```
Jadval ustuni (desktop) — mxik ustuni yonida kichik badge (`"Onlayn"` / bo'sh).

### Yangi: `apps/web/app/(dashboard)/settings/ecommerce/page.tsx`

Mavjud `SettingsForm` komponenti qayta ishlatiladi (`online_payments` sahifasi bilan bir
xil naqsh):
```tsx
<SettingsForm
  title="Onlayn savdo"
  settingsKey="ecommerce"
  fields={[{ key: "online_warehouse_id", label: "Onlayn savdo ombori", type: "select",
             options: warehouses.map(w => ({ value: w.id, label: w.name })) }]}
/>
```

### `apps/web/app/(shop)/...` (EC-8 qamrovi — bu yerda faqat joylashuv belgilanadi)

Yangi Next.js route group, mavjud `(portal)`/`(dashboard)` guruhlaridan ALOHIDA (auth
yo'q — layout'da JWT/organization context kerak emas). EC-8 to'ldiradi.

## Xavfsizlik

- **Trifecta risk**: public endpoint + tashqi ma'lumot (mehmon telefon/ismi) + yozish
  huquqi (checkout) — klassik trifecta shakli, lekin bu yerda "maxfiy ma'lumotga kirish"
  komponenti yo'q (faqat o'ziga tegishli buyurtma yaratadi, boshqa hech narsani o'qimaydi) —
  xavf past, lekin rate-limit + org-scoped product validation shart (yuqorida).
- **MUST**: `verify_products_in_org` har checkout'da chaqirilishi shart — boshqa tashkilot
  mahsulotini sotib bo'lmasligi uchun (`create_sale_core` ichida avtomatik).
- **MUST**: `GET /shop/products` javobida `purchase_price`/`avg_cost` yo'q — SELECT
  ro'yxatida ILK KUNDAN faqat oq ro'yxat (whitelist) maydonlari, `SELECT *` ISHLATILMAYDI.
- **Audit**: `storefront/router.py` o'zi `log_action(db, org_id, user_id=None, "create",
  "storefront_orders", ...)` chaqiradi (org_id — `org_code`dan to'g'ri chiqarilgan,
  `X-Organization-Id` header'dan EMAS).
- **Rate-limit**: `/shop/products` 60/min, `/shop/checkout` 20/min, IP bo'yicha
  (`get_remote_address` — mavjud `limiter`).
- **SENSITIVE_KEYS**: yangi maxfiy maydon yo'q (telefon/ism audit logda redact qilinmaydi —
  mavjud `AuditMiddleware.SENSITIVE_KEYS`ga yangi kalit qo'shish SHART EMAS, chunki
  `/shop/checkout` o'z-o'zini logging qiladi, avtomatik `AuditMiddleware` orqali emas,
  skip-list orqali chiqarib tashlangan).

## Tests (acceptance)

- `test_storefront.py::test_catalog_excludes_unpublished` — `is_published_online=FALSE`
  mahsulot `/shop/products`da ko'rinmasligi
- `test_storefront.py::test_catalog_never_leaks_cost_fields` — response JSON kalitlarida
  `purchase_price`/`avg_cost` yo'qligini tasdiqlaydi (schema-based assert, hardcoded field
  ro'yxati emas — kelajakda yangi ichki maydon qo'shilsa ham test ushlab qolishi uchun
  "ruxsat etilgan kalitlar" whitelist bilan taqqoslash)
- `test_storefront.py::test_checkout_dedup_by_phone` — bir xil telefon bilan ikki checkout
  → bitta `customers` qatori
- `test_storefront.py::test_checkout_concurrent_last_unit` — ikki parallel so'rov, bitta
  dona qoldiq → faqat bittasi 201
- `test_storefront.py::test_checkout_cross_org_product_rejected` — Org B mahsuloti Org A
  `org_code`si bilan checkout qilinsa 422
- `test_sale_service.py::test_create_sale_core_matches_legacy_response` — `/sale/sales`
  refaktordan keyin ESKI javob shaklini aynan qaytarishini tasdiqlaydi (regression)

## Kontrakt MUZLATILDI ✓

`sale/service.py` (`create_sale_core`, `SaleLineInput`, `SaleCreateResult`,
`get_online_warehouse_id`) va `/shop/*` API shakli — yuqoridagidek. `EC-3` va `EC-6`
parallel ishlay oladi; ikkisi ham shu kontraktga quriladi, biri ikkinchisini kutmaydi.
