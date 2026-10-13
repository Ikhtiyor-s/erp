# DESIGN — Ecommerce: B2B Segment/Shartnoma Narx-Override (EC-2)

> Architect tomonidan yoziladi. Spec: `tickets/SPEC-ecommerce-b2b.md`.
> Bu hujjat **FREEZE**. `sale/service.py` qismi `tickets/DESIGN-ecommerce-b2c.md`dagi
> bilan SO'ZMA-SO'Z BIR XIL — bu yerda takrorlanadi, chunki EC-3 shu yerdan o'qiydi va
> ikkita hujjat orasida kontrakt farqlanib qolmasligi kerak.

## Yondashuv (1 abzats)

Ikki narx-manba kerak, ikkisi ham MINIMAL: (1) **mijoz-maxsus narx** — yangi
`customer_product_prices` jadvali (`organization_id, customer_id, product_id, price`);
(2) **segment chegirmasi** — YANGI jadval YARATILMAYDI, chunki `customer_categories.discount_pct`
ustuni ALLAQACHON MAVJUD (kod o'qishda topildi: `customer/router.py`da CRUD qilinadi,
`discount_pct NUMERIC(5,2)`), faqat HECH QAYERDA qo'llanilmaydi — bu funksiya shu mavjud
ustunni birinchi marta ISHLATADI, yangi jadval emas. Narx ustunligi: **mijoz-maxsus
(`customer_product_prices`) > segment (`customer_categories.discount_pct` ×
`products.sale_price`) > standart `products.sale_price`**. Funksiya `customer` moduliga
tegishli (yangi fayl `apps/api/app/modules/customer/pricing.py`) — na `sale`, na
`customer_portal`, chunki narx qoidasi fundamental ravishda mijoz-identity haqida
(`customer_categories`, `customer_product_prices` ikkisi ham allaqachon `customer`
modulida yashaydi), `sale/service.py` esa narx haqida UMUMAN BILMAYDI (pastga qarang,
"sale/service.py kontrakti" — chaqiruvchi tayyor narx bilan keladi).

**`contracts` jadvali bilan munosabat — ANIQ QAROR: ALOHIDA QOLADI, KENGAYTIRILMAYDI.**
Sabablari:
1. `contracts`da item-darajasidagi qator (`contract_items`) UMUMAN YO'Q — faqat
   doc-metadata (`doc_number`, `start_date`, `end_date`, `total_amount`, `status`).
   Item-narxni qo'shish uchun baribir YANGI child-jadval (`contract_items`) kerak
   bo'lardi — bu `customer_product_prices`ni to'g'ridan-to'g'ri yaratishga teng
   murakkablik, ustига `contract_id` FK bog'lashning qo'shimcha og'irligi bilan.
2. `contracts`ning o'z lifecycle'i bor (`draft→active→closed→cancelled`,
   `start_date`/`end_date`). Mijoz-maxsus narx esa shartnoma holatidan QATIY NAZAR
   qo'llanilishi kerak bo'lishi mumkin (masalan norasmiy VIP-narx, hali shartnoma
   imzolanmagan). Narx-resolution'ni contract-status'ga bog'lash har bir mahsulot
   ro'yxati so'rovida qo'shimcha JOIN + holat-tekshiruv qo'shadi — bu sprintning
   minimal-backend maqsadiga ziddir.
3. SPEC'ning o'zi ("to'liq CRUD panel keyingi sprint") shuni ko'rsatadi — bu sprint
   FAQAT ishlaydigan minimal mexanizm, kontraktlar bilan rasmiy integratsiya emas.

Rad etilgan alternativalar:
- **Mavjud `price_lists`/`price_list_items`ni qayta ishlatish** — bu jadval kod o'qishda
  TOPILDI (`reference/router.py`da to'liq CRUD bor — `GET/POST/PUT/DELETE
  /reference/price-lists`), LEKIN `customers`/`customer_categories`ga HECH QANDAY bog'lanish
  yo'q (`customers.price_list_id` ustuni yo'q, assignment endpoint yo'q) — ya'ni bu o'lik
  scaffolding, hech qayerda ishlatilmaydi. Qayta ishlatish uchun baribir yangi
  `customers.price_list_id` ustuni + assignment logikasi yozilishi kerak bo'lardi (xuddi
  `customer_product_prices` yaratishga teng ish), ustiga `price_list_items`ning narxi
  `currency_id`ga bog'liq absolute qiymat — segment FOIZ-chegirma (`discount_pct`)
  tushunchasiga mos emas, ikkinchi mexanizm baribir kerak bo'lardi. Shu sabablarga ko'ra
  mavjud-lekin-ishlatilmayotgan bu jadval TEGILMAYDI (o'lik qoladi, keyingi sprintda
  PM/architect qarasin — bu DESIGN uni o'zgartirmaydi).
- **`customer_categories`ga yangi `customer_category_discounts` jadvali qo'shish** (ticket
  taklif qilgan ikkinchi variant) — rad etildi: `discount_pct` ustuni ALLAQACHON mavjud va
  bitta kategoriya = bitta foiz modeliga mos keladi (SPEC 1:1 "kategoriya→chegirma"
  so'raydi, "kategoriya→mahsulot→chegirma" matritsasi so'ramaydi). Yangi jadval ortiqcha
  murakkablik.
- **Narxni `sale/service.py` ichida hal qilish** — rad etildi, `DESIGN-ecommerce-b2c.md`da
  asoslangan: `sale/service.py` uchta chaqiruvchiga (ichki /sale/sales, B2B, B2C) xizmat
  qiladi va B2C'da narx qoidasi UMUMAN YO'Q (mehmon = standart narx) — pricing-aware
  qilish `sale/service.py`ni keraksiz murakkablashtiradi va B2C yo'lini ham sekinlashtiradi
  (har checkout'da kerak bo'lmagan segment-lookup).

## Fayl tuzilishi

### Yangi fayllar
- `apps/api/app/modules/customer/pricing.py` — `resolve_customer_price()`,
  `resolve_customer_prices_batch()`
- `apps/api/app/modules/sale/service.py` — **`DESIGN-ecommerce-b2c.md`da yaratiladi**
  (EC-9/EC-6 qamrovi), bu yerda FAQAT iste'mol qilinadi, qayta yaratilmaydi

### Edit qilinadigan fayllar
- `apps/api/app/db/schema_patches.py` — `customer_product_prices` jadvali (pastga qarang)
- `apps/api/app/modules/customer/router.py` — minimal CRUD (pastga qarang, API kontrakti)
- `apps/api/app/modules/customer_portal/router.py` — **EC-3 qamrovi**, bu DESIGN emas:
  `GET /products` va `POST /me/orders` `resolve_customer_price()`ni chaqirishi SHART,
  aniq joylashtirish/wiring EC-3 ishi

## DB o'zgarishlari

```sql
CREATE TABLE IF NOT EXISTS customer_product_prices (
    id              BIGSERIAL PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    price           NUMERIC(20,2) NOT NULL CHECK (price >= 0),
        -- products.currency_id bilan BIR XIL valyutada deb FARZ QILINADI — bu sprintda
        -- FX konversiya YO'Q (SPEC "Ko'p valyutali checkout — out of scope"ga mos)
    notes           TEXT,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (organization_id, customer_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_cpp_org_customer
    ON customer_product_prices(organization_id, customer_id);
```

**Migration safety**: yangi jadval, hech qanday mavjud ustunga tegmaydi — lock-free.
**Rollback**: `DROP TABLE IF EXISTS customer_product_prices;` — xavfsiz, boshqa jadvalga
bog'liqlik yo'q (faqat FK — DROP CASCADE kerak emas, chunki hech kim bu jadvalga FK
qilmaydi).

`customer_categories.discount_pct` — ustunga TEGILMAYDI, faqat birinchi marta
ISHLATILADI (quyida).

## `resolve_customer_price()` kontrakti (FREEZE — `customer` moduli egalik qiladi)

```python
# apps/api/app/modules/customer/pricing.py
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession

async def resolve_customer_price(
    db: AsyncSession,
    org_id: str,
    customer_id: str | None,   # None → har doim base_price qaytadi (guest/B2C)
    product_id: str,
    base_price: Decimal,       # chaqiruvchi beradi — odatda products.sale_price
) -> Decimal:
    """
    Ustunlik: customer_product_prices (aniq mos customer_id+product_id)
            > customer_categories.discount_pct (customers.category_id orqali)
              → ROUND(base_price * (1 - discount_pct/100), 2)
            > base_price (o'zgarishsiz)
    organization_id HAR DOIM filtrga kiritiladi (cross-tenant himoya, mavjud HI-1
    naqshiga mos) — customer_id/product_id allaqachon org-scoped FK bo'lsa ham.
    """

async def resolve_customer_prices_batch(
    db: AsyncSession,
    org_id: str,
    customer_id: str | None,
    product_base_prices: dict[str, Decimal],   # {product_id: products.sale_price}
) -> dict[str, Decimal]:
    """Katalog ro'yxati uchun — N+1 oldini oladi: customer_product_prices'dan BARCHA
    mos qatorlarni bitta so'rovda, customer_categories.discount_pct'ni bitta so'rovda
    oladi, keyin Python'da har mahsulotga ustunlikni qo'llaydi."""
```

**Kim chaqiradi** (EC-1/EC-3 qamrovi, bu yerda faqat kontrakt sifatida belgilanadi):
- `GET /customer-portal/products` (EC-1 — mustaqil, allaqachon boshqa joyda ishlab
  chiqilmoqda) — har bir qator narxini `resolve_customer_prices_batch()` orqali olishi
  SHART. Agar EC-1 bu DESIGN'dan OLDIN boshqacha narx-ko'rsatish bilan tugagan bo'lsa,
  javob SHAKLI o'zgarmaydi (`price`: bitta Decimal/float maydon) — faqat qiymat
  hisoblash usuli EC-3 bosqichida shu funksiyaga almashtiriladi.
- `POST /customer-portal/me/orders` (EC-3) — har bir qator uchun
  `resolve_customer_price()` chaqiradi, natijani `sale/service.py`dagi
  `SaleLineInput.price` sifatida uzatadi (`DESIGN-ecommerce-b2c.md`dagi kontrakt bilan
  bir xil — pastga qarang).

## `sale/service.py` kontrakti — `DESIGN-ecommerce-b2c.md`dan SO'ZMA-SO'Z (takrorlanadi)

```python
# apps/api/app/modules/sale/service.py  (EC-9/EC-6 qamrovida yaratiladi, EC-3 shundan
# import qiladi — fayl EC-2/EC-3 tomonidan QAYTA YARATILMAYDI)
from dataclasses import dataclass
from decimal import Decimal

@dataclass
class SaleLineInput:
    product_id: str
    quantity: Decimal
    price: Decimal              # EC-3: resolve_customer_price() natijasi shu yerga keladi
    discount: Decimal = Decimal("0")

@dataclass
class SaleCreateResult:
    sale_id: str
    total_amount: Decimal
    total_cost: Decimal

async def verify_warehouse_in_org(db, warehouse_id: int, org_id: str) -> None: ...
async def verify_products_in_org(db, product_ids: list[str], org_id: str) -> None: ...
async def get_online_warehouse_id(db, org_id: str) -> int | None:
    """app_settings[key='ecommerce'].value['online_warehouse_id'] — B2B va B2C BIR XIL
    sozlamadan foydalanadi."""

async def create_sale_core(
    db, *, org_id: str, customer_id: str | None, warehouse_id: int,
    currency_id: int, rate: Decimal, items: list[SaleLineInput],
    notes: str | None, user_id: str | None, source_type: str = "sale",
) -> SaleCreateResult: ...
    # EC-3: user_id = buyurtma bergan xodim bo'lsa shu, lekin odatda mijozning o'zi
    # tomonidan customer_portal orqali — user_id=None (sales.created_by nullable).
    # customer_id — HAR DOIM to'ladi (B2B'da mehmon yo'q, mijoz OTP bilan tanilgan).
    # source_type="sale_b2b_portal" tavsiya etiladi (SHOULD) — moliya journal
    # browser'da B2B-portal savdosini ajrata olishi uchun; default "sale" bilan ham
    # to'liq ishlaydi (orqaga-mos).
```

**Kim committing qiladi**: `create_sale_core()` ICHIDA. EC-3 keyin O'ZINING
`customer_portal_orders` metadata yozuvini (`sale_id` FK bilan) yozadi va o'z
`log_action()` + commit'ini qiladi — `DESIGN-ecommerce-b2c.md`dagi B2C oqimi bilan bir
xil naqsh, faqat metadata jadvali farqli (`customer_portal_orders` vs
`storefront_orders`).

**Stock-race / warehouse resolution**: B2B portalda ham mijoz ombor tanlamaydi
(SPEC MUST), shuning uchun `get_online_warehouse_id()` B2C bilan BIR XIL chaqiriladi —
ikki alohida sozlama YO'Q, bitta `app_settings['ecommerce']['online_warehouse_id']`.

## API kontrakti (FREEZE) — yangi minimal CRUD (`customer_product_prices`)

> `/customer-portal/products` va `/customer-portal/me/orders`ning to'liq so'rov/javob
> shakli EC-1/EC-3 qamrovi (backend-dev, parallel ishlaydi) — bu DESIGN ularni qayta
> belgilamaydi, faqat narx-funksiya kontraktini (yuqorida) muzlatadi. Quyidagi uchta
> endpoint esa YANGI va to'liq FREEZE qilinadi, chunki boshqa hech bir ticket ularni
> qamramaydi — admin/manager narxni kiritishi uchun minimal sirt (SPEC: "to'liq CRUD
> panel keyingi sprint", lekin ISHLASH uchun minimal backend CRUD bu sprintda kerak).

### `GET /api/v1/customer/customers/{cid}/prices`

**Response 200**:
```json
{"items": [{"product_id": "uuid", "product_name": "Coca-Cola 1.5L", "price": 15000.0,
            "notes": null, "updated_at": "2026-10-12T10:00:00Z"}]}
```
**Errors**: `404` — `cid` boshqa tashkilotga tegishli yoki topilmadi.

### `POST /api/v1/customer/customers/{cid}/prices` (upsert)

**Request**:
```json
{"product_id": "uuid", "price": 15000.0, "notes": "VIP shartnoma narxi"}
```
**Response 201**: `{"ok": true}`
**Errors**: `422` — `price < 0`; `404` — `cid`/`product_id` org'ga tegishli emas (mavjud
`_verify_products_in_org` naqshi qayta ishlatiladi).

### `DELETE /api/v1/customer/customers/{cid}/prices/{product_id}`

**Response 200**: `{"ok": true}` (override o'chadi → narx segment/standartga qaytadi).

## RBAC

| Endpoint | Permission code (middleware avtomatik chiqaradi) | Mavjud? |
|---|---|---|
| `GET /customer/customers/{cid}/prices` | `customer.view` | ✓ mavjud |
| `POST /customer/customers/{cid}/prices` | `customer.create` | ✓ mavjud (`POST /customer/customers/{id}/set-balance` bilan bir xil derivation naqshi) |
| `DELETE /customer/customers/{cid}/prices/{product_id}` | `customer.delete` | ✓ mavjud |

**Yangi permission SHART EMAS.**

## Frontend

To'liq CRUD panel **out of scope** (SPEC, "QILMAYMIZ"). Bu sprintda FE yo'q — yuqoridagi
uch endpoint Postman/ichki admin tool orqali ishlatiladi, yoki EC-4 xohlasa mijoz
profilida mavjud `apps/web/app/(dashboard)/customer/customers/[id]/page.tsx`ga (bor
bo'lsa) sodda jadval sifatida biriktirishi MUMKIN (MAY, bu ticket buni talab qilmaydi).

## Xavfsizlik

- **MUST**: `customer_product_prices` CRUD — `organization_id` filtri HAR UCH
  endpointda (mavjud HI-1 naqshi: `_verify_products_in_org` qayta ishlatiladi).
- **MUST**: `resolve_customer_price()` — `customer_id=None` bo'lsa HECH QACHON
  `customer_categories`/`customer_product_prices`ga so'rov yubormaydi, to'g'ridan-to'g'ri
  `base_price` qaytaradi (B2C mehmon yo'li uchun tezkor qisqa yo'l, keraksiz JOIN yo'q).
- **Audit log**: yangi CRUD — mavjud `AuditMiddleware` avtomatik ushlaydi (`/customer/`
  prefiksi allaqachon audit qilinadi), `price` maydoni `SENSITIVE_KEYS`da emas — oddiy
  log qilinadi.

## Tests (acceptance)

- `test_pricing.py::test_precedence_customer_over_segment` — mijoz-maxsus narx
  mavjud bo'lsa, segment chegirmasi e'tiborga olinmaydi
- `test_pricing.py::test_precedence_segment_over_standard` — faqat segment bor bo'lsa,
  `discount_pct` qo'llanadi
- `test_pricing.py::test_no_override_returns_base_price` — hech narsa yo'q bo'lsa
  `base_price` o'zgarishsiz
- `test_pricing.py::test_guest_customer_id_none_skips_lookup` — `customer_id=None` →
  DB so'rovsiz `base_price`
- `test_pricing.py::test_cross_tenant_price_isolation` — Org A'ning
  `customer_product_prices` yozuvi Org B mijozi uchun qo'llanmaydi

## Out of scope (SPEC'dan ko'chirilgan + aniqlashtirilgan)

- **Kredit limit ogohlantirishi** (SPEC SHOULD: "buyurtma summasi kredit limitidan
  oshsa ogohlantirish") — `customers` jadvalida `credit_limit` ustuni UMUMAN YO'Q (kod
  o'qishda tasdiqlandi). Bu DESIGN (faqat narx-model) bu ustunni QO'SHMAYDI — SHOULD
  (MUST emas) bo'lgani uchun bu sprintda qoldirilishi mumkin. Agar PM buni MUST qilishni
  xohlasa — yangi `customers.credit_limit` ustuni kerak, bu alohida kichik qaror, EC-3
  bosqichida PM bilan tasdiqlanishi kerak (yangi ustun = yangi qaror, bu DESIGN doirasida
  emas).
- **`contracts`ga item-level narx qo'shish** — yuqorida asoslab rad etildi, lekin
  "ALMOST designed in": `customer_product_prices`ga ixtiyoriy `contract_id UUID NULL
  REFERENCES contracts(id)` ustuni qo'shish mumkin edi (override qaysi shartnomaga
  tegishli ekanligini belgilash uchun, faqat audit/izlash maqsadida, resolution
  logikasiga ta'sir qilmasdan). Bu sprintda QILINMADI — contracts hali item-line
  tushunchasiga ega emas, bu ustun hozircha hech narsaga bog'lanmaydi (orphan FK).
  Keyingi sprint, contracts kengaytirilganda qo'shiladi.
- **To'liq narx-ro'yxat admin paneli** (`price_lists` jadvalini jonlantirish) — SPEC
  "QILMAYMIZ"ga mos, tegilmadi.

## Kontrakt MUZLATILDI ✓

`customer_product_prices` DDL, `resolve_customer_price()`/`resolve_customer_prices_batch()`
signaturasi, va `sale/service.py` kontrakti (DESIGN-ecommerce-b2c.md bilan bir xil) —
yuqoridagidek. EC-3 shu uchta narsaga quradi, qayta loyihalash kerak emas.
