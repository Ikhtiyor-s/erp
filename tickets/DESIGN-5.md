# DESIGN-5.md — Aniq ERP Sprint 5 Architecture Decisions
> Architect: Claude Sonnet 4.6 | Date: 2026-09-05 | Status: FROZEN (API contract section)

---

## 1. Executive Summary

Sprint 5 uchta asosiy arxitektura muammosini hal qiladi:

1. `stock_movements` immutable journal — `_stock_apply` har chaqirilganda journal yozadi, DB trigger UPDATE/DELETE ni blokaydi.
2. `IdempotencyMiddleware` — FastAPI `BaseHTTPMiddleware` sifatida, JSONB saqlash, 24h TTL, whitelist pattern.
3. `inventory_scan_events` additive table (Variant C) — optimistic lock emas, additive events — TZ-12 parallel scan + rollback/tarix talablariga javob beradi.

CTO uchun: dev'lar boshlashdan oldin `stock_movements` DDL va trigger `schema_patches.py`ga kirishi shart — bu boshqa hamma narsaga blocker. `_stock_apply` signature o'zgarishi barcha 7 ta call site'ni birdan update qilishni talab qiladi.

---

## 2. Stack

Mavjud stack o'zgarishsiz. Yangi dependency yo'q.

| Qatlam | Texnologiya |
|---|---|
| Backend | FastAPI 0.115, SQLAlchemy 2.0 async, asyncpg, Pydantic v2 |
| DB | PostgreSQL 16 — yangi jadvallar `schema_patches.py`ga qo'shiladi |
| Middleware | `starlette.middleware.base.BaseHTTPMiddleware` (mavjud pattern, AuditMiddleware kabi) |
| Frontend | Next.js 15, TypeScript, Tailwind — mavjud konvensiyalar |

---

## 3. File / Folder Layout

Yangi fayllar:

```
apps/api/app/
  modules/
    warehouse/
      service.py          # MODIFIED: _stock_apply yangi signature + journal write
      router.py           # MODIFIED: GET /warehouse/movements endpoint qo'shiladi
    idempotency/
      middleware.py       # NEW: IdempotencyMiddleware
      deps.py             # NEW: get_idempotency_store dependency (optional)
  db/
    schema_patches.py     # MODIFIED: stock_movements, idempotency_keys, inventory_scan_events DDL

apps/web/app/(dashboard)/
  warehouse/
    movements/
      page.tsx            # NEW: stock movements journal page
  warehouse/
    inventories/          # MODIFIED: scan events UI + 409 handling
```

---

## 4. Qaror 1 — `stock_movements` Immutable Journal

### 4.1 Tanlangan variant: B (DB-level trigger) + A (application-level enforced INSERT only)

**Rationale:** Variant A (application-level only) yetarli emas — to'g'ridan-to'g'ri SQL yoki boshqa agent yozsa himoyasiz. Variant C (RLS) keraksiz murakkab. Variant B trigger + application INSERT-only kombinatsiyasi: DB darajasida kafolat, service darajasida tozalik.

### 4.2 `stock_movements` DDL

```sql
CREATE TABLE IF NOT EXISTS stock_movements (
    id               BIGSERIAL PRIMARY KEY,
    organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    warehouse_id     INT  NOT NULL REFERENCES warehouses(id),
    product_id       UUID NOT NULL REFERENCES products(id),

    -- Qiymatlar
    before_qty       NUMERIC(20,3) NOT NULL,
    change_qty       NUMERIC(20,3) NOT NULL,   -- + kirish, - chiqish
    after_qty        NUMERIC(20,3) NOT NULL,
    unit_cost        NUMERIC(20,4),             -- NULL = cost ma'lum emas

    -- Manba hujjat
    operation_type   VARCHAR(30) NOT NULL,
    -- operation_type enum: 'sale', 'sale_return', 'supply', 'supply_return',
    --   'transfer_out', 'transfer_in', 'write_off', 'posting',
    --   'inventory_adjust', 'opening_balance', 'manufacturing_in', 'manufacturing_out'
    source_type      VARCHAR(30),               -- 'sale', 'internal_transfer', 'write_off', ...
    source_id        UUID,                       -- hujjat UUID
    correlation_id   UUID,                       -- transfer send+receive ni birlashtiradi

    -- Foydalanuvchi
    user_id          UUID REFERENCES users(id),
    external_id      VARCHAR(100),              -- tashqi tizim identifikatori (POS, 1C)
    notes            TEXT,

    -- Vaqt
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    -- NO updated_at, NO deleted_at — immutable
);

-- Indekslar
CREATE INDEX IF NOT EXISTS idx_sm_org_wh_product
    ON stock_movements (organization_id, warehouse_id, product_id);
CREATE INDEX IF NOT EXISTS idx_sm_org_created
    ON stock_movements (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sm_source
    ON stock_movements (source_type, source_id)
    WHERE source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sm_correlation
    ON stock_movements (correlation_id)
    WHERE correlation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sm_operation_type
    ON stock_movements (organization_id, operation_type);
```

### 4.3 Append-Only Enforcement (DB Trigger)

```sql
-- Trigger funksiyasi
CREATE OR REPLACE FUNCTION stock_movements_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'stock_movements is append-only: UPDATE and DELETE are forbidden';
END;
$$;

-- Trigger
CREATE TRIGGER trg_stock_movements_immutable
    BEFORE UPDATE OR DELETE ON stock_movements
    FOR EACH ROW EXECUTE FUNCTION stock_movements_immutable();
```

Trigger `schema_patches.py`ga `CREATE OR REPLACE` + `CREATE TRIGGER IF NOT EXISTS` pattern bilan qo'shiladi (idempotent).

> NOT: PostgreSQL `CREATE TRIGGER IF NOT EXISTS` 16+ da ishlaydi. Agar versiyon eski bo'lsa, `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;` pattern ishlatiladi.

### 4.4 `_stock_apply` Yangi Signature

```python
async def _stock_apply(
    db: AsyncSession,
    org_id: str,                    # NEW — journal uchun shart
    warehouse_id: int,
    product_id: str,
    delta_qty: Decimal,
    cost: Decimal | None = None,
    *,
    allow_negative: bool = False,
    operation_type: str = "manual", # NEW — journal uchun shart
    source_type: str | None = None, # NEW
    source_id: str | None = None,   # NEW
    correlation_id: str | None = None, # NEW — transfer uchun
    user_id: str | None = None,     # NEW
    notes: str | None = None,       # NEW
) -> None:
    """
    1. stock_balances uchun SELECT ... FOR UPDATE (concurrency lock)
    2. Balance tekshirish (allow_negative=False)
    3. stock_balances UPSERT (avg_cost weighted average)
    4. stock_movements INSERT (journal, immutable)
    Callers MUST NOT commit inside; commit belongs to caller.
    """
```

**Concurrency pattern (stock_balances lock):**
```python
# Har _stock_apply ichida:
lock_res = await db.execute(
    text(
        "SELECT quantity, avg_cost FROM stock_balances "
        "WHERE warehouse_id = :w AND product_id = :p FOR UPDATE"
    ),
    {"w": warehouse_id, "p": product_id},
)
row = lock_res.first()
before_qty = Decimal(str(row.quantity)) if row else Decimal("0")
avg_cost_before = Decimal(str(row.avg_cost)) if row else Decimal("0")
after_qty = before_qty + delta_qty
# ... balance check + upsert ...
# Then INSERT into stock_movements:
await db.execute(
    text(
        "INSERT INTO stock_movements "
        "(organization_id, warehouse_id, product_id, "
        " before_qty, change_qty, after_qty, unit_cost, "
        " operation_type, source_type, source_id, correlation_id, "
        " user_id, notes) "
        "VALUES (:o, :w, :p, :bq, :dq, :aq, :uc, :ot, :st, :si, :ci, :u, :n)"
    ),
    {
        "o": org_id, "w": warehouse_id, "p": product_id,
        "bq": before_qty, "dq": delta_qty, "aq": after_qty,
        "uc": cost, "ot": operation_type,
        "st": source_type, "si": source_id, "ci": correlation_id,
        "u": user_id, "n": notes,
    },
)
```

### 4.5 `correlation_id` — Transfer Logikasi

Transfer uchun:
- `send` endpoint: `correlation_id = str(uuid4())` yaratadi, `transfer_out` harakati yozadi, `correlation_id` ni `internal_transfers.correlation_id` ga saqlaydi.
- `receive` endpoint: `correlation_id` ni `internal_transfers`dan o'qiydi, `transfer_in` harakati uchun qayta ishlatadi.

```sql
ALTER TABLE internal_transfers
    ADD COLUMN IF NOT EXISTS correlation_id UUID;
CREATE INDEX IF NOT EXISTS idx_internal_transfers_correlation
    ON internal_transfers (correlation_id) WHERE correlation_id IS NOT NULL;
```

### 4.6 Migration — Mavjud `_stock_apply` Call Sites (7 ta joy)

| # | Fayl | Qator (approx) | operation_type | source_type | source_id |
|---|------|----------------|----------------|-------------|-----------|
| 1 | `warehouse/router.py` ~572 | inventory confirm | `inventory_adjust` | `inventory` | `iid` |
| 2 | `warehouse/router.py` ~799 | transfer send | `transfer_out` | `internal_transfer` | `tid` |
| 3 | `warehouse/router.py` ~838 | transfer receive | `transfer_in` | `internal_transfer` | `tid` |
| 4 | `warehouse/router.py` ~882 | transfer cancel (rollback) | `transfer_out` | `internal_transfer` | `tid` |
| 5 | `warehouse/router.py` ~1025 | write-off create | `write_off` | `write_off` | `wid` |
| 6 | `warehouse/router.py` ~2169 | product import (opening balance) | `opening_balance` | `import` | NULL |
| 7 | (sale router — T-201) | sale confirm | `sale` | `sale` | sale_id |

**Migration rule:** Barcha call site'lar `org_id` ni `Depends(get_current_org_id)` dan oladi — bu allaqachon handler signatureda mavjud. Backend dev har call site'ni yangi parametrlar bilan yangilaydi. Eski signature `cost` positional edi — yangi `cost` keyword-only emas (Decimal | None) sifatida saqlanadi, `operation_type` default `"manual"` (backward compat uchun).

---

## 5. Qaror 2 — Idempotency-Key Middleware

### 5.1 Tanlangan variant: FastAPI `BaseHTTPMiddleware` (AuditMiddleware pattern)

**Rationale:** `app.add_middleware(IdempotencyMiddleware)` — mavjud `AuditMiddleware` bilan bir xil mounting. DB dependency yoki global state talab qilmaydi. Response'ni intercept qilish `BaseHTTPMiddleware.dispatch` orqali amalga oshiriladi.

### 5.2 `idempotency_keys` DDL

```sql
CREATE TABLE IF NOT EXISTS idempotency_keys (
    id              BIGSERIAL PRIMARY KEY,
    idempotency_key VARCHAR(128) NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    method          VARCHAR(10) NOT NULL,
    path            VARCHAR(255) NOT NULL,
    request_hash    VARCHAR(64) NOT NULL,   -- SHA-256 hex of request body
    response_status INT NOT NULL,
    response_body   JSONB NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    UNIQUE (idempotency_key, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_org_key
    ON idempotency_keys (organization_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_idempotency_expires
    ON idempotency_keys (expires_at);
```

### 5.3 Middleware Kod Skeleti

```python
# apps/api/app/modules/idempotency/middleware.py
import hashlib, json, logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from app.db.session import AsyncSessionLocal

log = logging.getLogger(__name__)

# Faqat shu path prefix'lar + method'lar uchun ishlaydi
IDEMPOTENCY_WHITELIST: set[str] = {
    # (method, path_prefix)
    ("POST", "/api/v1/sale/sales"),
    ("POST", "/api/v1/sale/returns"),
    ("POST", "/api/v1/warehouse/receipts"),        # oprihodovanie (T-201)
    ("POST", "/api/v1/warehouse/write-offs"),
    ("POST", "/api/v1/warehouse/transfers"),
    ("POST", "/api/v1/finance/cash-movements"),
    ("PATCH", "/api/v1/sale/sales/"),              # status update
    ("DELETE", "/api/v1/sale/sales/"),
}


def _is_whitelisted(method: str, path: str) -> bool:
    for m, prefix in IDEMPOTENCY_WHITELIST:
        if method == m and path.startswith(prefix):
            return True
    return False


class IdempotencyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        ikey = request.headers.get("Idempotency-Key")
        if not ikey or not _is_whitelisted(request.method, request.url.path):
            return await call_next(request)

        org_id = request.headers.get("X-Organization-Id")
        user_id = getattr(request.state, "user_id", None)
        if not org_id or not user_id:
            return await call_next(request)  # auth middleware hallqiladi

        body_bytes = await request.body()
        request_hash = hashlib.sha256(body_bytes).hexdigest()

        async def receive():
            return {"type": "http.request", "body": body_bytes, "more_body": False}
        request._receive = receive  # type: ignore

        async with AsyncSessionLocal() as db:
            # 1. Mavjudligini tekshir
            from sqlalchemy import text
            res = await db.execute(
                text(
                    "SELECT response_status, response_body, request_hash "
                    "FROM idempotency_keys "
                    "WHERE idempotency_key = :k AND organization_id = :o "
                    "  AND expires_at > NOW()"
                ),
                {"k": ikey, "o": org_id},
            )
            existing = res.first()

        if existing:
            if existing.request_hash != request_hash:
                # Bir xil key, boshqa body — 409 Conflict
                return JSONResponse(
                    status_code=409,
                    content={
                        "detail": "Idempotency-Key conflict: same key used with different request body",
                        "code": "IDEMPOTENCY_CONFLICT",
                    },
                    headers={"Idempotency-Key": ikey, "X-Idempotency-Replayed": "false"},
                )
            # Cached javob qaytariladi
            return JSONResponse(
                status_code=existing.response_status,
                content=existing.response_body,
                headers={"Idempotency-Key": ikey, "X-Idempotency-Replayed": "true"},
            )

        # 2. So'rovni bajar
        response = await call_next(request)

        # 3. Muvaffaqiyatli bo'lsa saqla (2xx only)
        if 200 <= response.status_code < 300:
            # Response body'ni o'qi
            resp_body_bytes = b""
            async for chunk in response.body_iterator:
                resp_body_bytes += chunk
            try:
                resp_json = json.loads(resp_body_bytes)
            except Exception:
                resp_json = {"_raw": resp_body_bytes.decode(errors="replace")}

            try:
                async with AsyncSessionLocal() as db:
                    from sqlalchemy import text
                    await db.execute(
                        text(
                            "INSERT INTO idempotency_keys "
                            "(idempotency_key, organization_id, user_id, method, path, "
                            " request_hash, response_status, response_body) "
                            "VALUES (:k, :o, :u, :m, :p, :rh, :rs, :rb) "
                            "ON CONFLICT (idempotency_key, organization_id) DO NOTHING"
                        ),
                        {
                            "k": ikey, "o": org_id, "u": user_id,
                            "m": request.method, "p": request.url.path,
                            "rh": request_hash, "rs": response.status_code,
                            "rb": json.dumps(resp_json),
                        },
                    )
                    await db.commit()
            except Exception as e:
                log.debug("Idempotency save failed (non-fatal): %s", e)

            return JSONResponse(
                status_code=response.status_code,
                content=resp_json,
                headers={"Idempotency-Key": ikey, "X-Idempotency-Replayed": "false"},
            )

        return response
```

**Cleanup strategiyasi:** Lazy delete — har INSERT oldida `DELETE FROM idempotency_keys WHERE expires_at < NOW() AND organization_id = :o` (same-org, cheap). Yoki alohida cron endpoint: `POST /api/v1/internal/cleanup-idempotency` (admin only, rate limited).

**`main.py`ga qo'shish:**
```python
from app.modules.idempotency.middleware import IdempotencyMiddleware
# ...
app.add_middleware(IdempotencyMiddleware)
# AuditMiddleware dan OLDIN mount qilinadi (LIFO — last added runs first)
```

### 5.4 Whitelist Qoidalari

- MUST: `POST` va `DELETE` va `PATCH` — faqat state-changing
- MUST NOT: `GET`, `PUT /warehouses/{id}` (idempotent by nature)
- Idempotency-Key header OPTIONAL — agar kelmasа, middleware o'tkazib yuboradi
- Header format: `Idempotency-Key: <uuid-v4>` (validation: UUID format tekshirilmaydi, har qanday 128 char qabul qilinadi)

---

## 6. Qaror 3 — Parallel Scan Protection

### 6.1 Tanlangan variant: C — Additive Scan Events

**Rationale:**

- **A (Optimistic lock)** — sodda, lekin `expected_version` ni frontend track qilishi kerak, va ikki user bir vaqtda `actual_qty`ga write qilsa biri reject bo'ladi. Bir product uchun 409 error POS operatorga noqulay.
- **B (Pessimistic lock)** — slow, scanner'lar navbatga tushadi.
- **C (Additive events)** — eng yaxshi: har scan alohida yozuv. `actual_qty = SUM(scan_events.qty)` view yoki materialized. TZ-12: "bir nechta foydalanuvchi + parallel scan" — hech qanday conflict yo'q. Bonus: tarix + rollback.

### 6.2 `inventory_scan_events` DDL

```sql
CREATE TABLE IF NOT EXISTS inventory_scan_events (
    id              BIGSERIAL PRIMARY KEY,
    inventory_id    UUID NOT NULL REFERENCES inventories(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    qty             NUMERIC(20,3) NOT NULL,      -- delta (always positive scan qty)
    scanned_by      UUID NOT NULL REFERENCES users(id),
    scanned_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cell_id         UUID REFERENCES warehouse_cells(id),  -- optional: qaysi hujayradan
    barcode_raw     VARCHAR(100),               -- skanerlangan barcode (audit uchun)
    notes           TEXT,
    is_voided       BOOLEAN NOT NULL DEFAULT FALSE  -- rollback uchun (soft delete)
);

CREATE INDEX IF NOT EXISTS idx_ise_inventory_product
    ON inventory_scan_events (inventory_id, product_id)
    WHERE is_voided = FALSE;
CREATE INDEX IF NOT EXISTS idx_ise_inventory_scanned
    ON inventory_scan_events (inventory_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_ise_org
    ON inventory_scan_events (organization_id, scanned_at DESC);
```

**Aggregate view (opsional, performance uchun):**
```sql
CREATE OR REPLACE VIEW inventory_item_actual AS
SELECT
    inventory_id,
    product_id,
    SUM(qty) AS actual_qty,
    MAX(scanned_at) AS last_scanned_at,
    COUNT(*) AS scan_count
FROM inventory_scan_events
WHERE is_voided = FALSE
GROUP BY inventory_id, product_id;
```

`inventory_items.actual_qty` avtomatik saqlanmaydi — har GET paytida SUM hisoblanadi (yoki view'dan o'qiladi). `inventory_items.actual_qty` DB generatsiya qilinmagan, manual yangilanadi faqat `POST /scan` endpoint chaqirilganda.

**`inventory_items` yangi ustunlar:**
```sql
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 0;
-- version optimistic lock emas — faqat scan_events aggregate uchun cache invalidation marker
-- Har scan event qo'shilganda version++ (trigger yoki service level)
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS scanned_by UUID REFERENCES users(id);
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMPTZ;
```

**`inventories` yangi ustunlar:**
```sql
ALTER TYPE inventory_status ADD VALUE IF NOT EXISTS 'paused';
ALTER TYPE inventory_status ADD VALUE IF NOT EXISTS 'pending_confirmation';
ALTER TABLE inventories ADD COLUMN IF NOT EXISTS is_blind BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE inventories ADD COLUMN IF NOT EXISTS lock_mode VARCHAR(20) DEFAULT 'none';
-- lock_mode: 'none' | 'soft' (read allowed) | 'hard' (no movements allowed)
```

### 6.3 Endpoint Flow

**POST /api/v1/warehouse/inventories/{iid}/scan**

Request:
```json
{
  "product_id": "uuid",
  "qty": 5.0,
  "barcode_raw": "4600000000001",
  "cell_id": "uuid|null",
  "notes": "optional"
}
```

Backend flow:
1. `inventories WHERE id=:iid AND org_id=:o` — status `in_progress` yoki `paused` tekshir (404 agar yo'q, 409 agar `completed`)
2. `INSERT INTO inventory_scan_events (...)` — always succeeds (no conflict)
3. `UPDATE inventory_items SET actual_qty = (SELECT SUM(qty) FROM inventory_scan_events WHERE inventory_id=:iid AND product_id=:pid AND is_voided=FALSE), scanned_by=:u, scanned_at=NOW(), version=version+1 WHERE inventory_id=:iid AND product_id=:pid`
4. Agar `inventory_items` qatori yo'q (yangi tovar inventarizatsiya paytida topilgan): INSERT with `expected_qty=0`
5. Return: yangi `actual_qty`, `scan_event_id`, `scan_count`

Response (200):
```json
{
  "scan_event_id": 12345,
  "product_id": "uuid",
  "actual_qty": "15.000",
  "scan_count": 3,
  "last_scanned_at": "2026-09-05T10:23:00Z"
}
```

**DELETE /api/v1/warehouse/inventories/{iid}/scan-events/{event_id}** — void (rollback)

Backend:
1. `inventory_scan_events WHERE id=:eid` ownership tekshir (org + inventory match)
2. `UPDATE inventory_scan_events SET is_voided=TRUE WHERE id=:eid`
3. `UPDATE inventory_items SET actual_qty = (SUM ...) WHERE ...`

### 6.4 409 UX — Hozir Yo'q (Additive = No Conflict)

Additive events bilan 409 Conflict inventarizatsiya scanning uchun chiqmaydi. Faqat quyidagi hollarda 409 qaytariladi:
- `POST /scan` on `completed` inventory → `409 {"detail": "Inventarizatsiya allaqachon yakunlangan", "code": "INVENTORY_COMPLETED"}`
- `POST /scan` on `cancelled` inventory → `409 {"detail": "Inventarizatsiya bekor qilingan", "code": "INVENTORY_CANCELLED"}`

Frontend tomonidan: status tekshirish, 409 toast.error, refresh button.

### 6.5 Aggregate Query Performans

```sql
-- idx_ise_inventory_product (inventory_id, product_id WHERE is_voided=FALSE)
-- bu index SUM query uchun optimal:
SELECT SUM(qty) FROM inventory_scan_events
WHERE inventory_id = :iid AND product_id = :pid AND is_voided = FALSE;
-- = index-only scan, O(scan_count) — acceptable (100-200 scan per item max)
```

Large inventory (10k+ items) uchun: `inventory_items.actual_qty` denormalized kolumn saqlanadi va har scan da UPDATE qilinadi (6.3 da ko'rsatilgan). Bu confirm paytida full re-aggregate ni bartaraf qiladi.

---

## 7. API Contract (FROZEN)

> Bu section muz chizig'i. O'zgartirish → PM orqali.

### 7.1 T-200 — Stock Movements Journal Endpoint

**GET /api/v1/warehouse/movements**

Permission: `warehouse.movements.view`

Query params:
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| warehouse_id | int | no | Filter by warehouse |
| product_id | UUID | no | Filter by product |
| operation_type | string | no | Filter by type (sale, supply, ...) |
| source_type | string | no | Filter by source |
| source_id | UUID | no | Filter by source document |
| date_from | date | no | ISO date (inclusive) |
| date_to | date | no | ISO date (inclusive) |
| page | int | no | Default 1 |
| limit | int | no | Default 50, max 200 |

Response 200:
```json
{
  "total": 1250,
  "page": 1,
  "limit": 50,
  "items": [
    {
      "id": 10001,
      "organization_id": "uuid",
      "warehouse_id": 3,
      "warehouse_name": "Asosiy ombor",
      "product_id": "uuid",
      "product_name": "Coca-Cola 1L",
      "before_qty": "100.000",
      "change_qty": "-10.000",
      "after_qty": "90.000",
      "unit_cost": "5500.0000",
      "operation_type": "sale",
      "source_type": "sale",
      "source_id": "uuid",
      "correlation_id": null,
      "user_id": "uuid",
      "user_name": "Sardor Toshmatov",
      "notes": null,
      "created_at": "2026-09-05T08:30:00Z"
    }
  ]
}
```

Response 403: `{"detail": "Permission denied"}`
Response 422: `{"detail": "Invalid filter parameters"}`

---

### 7.2 T-208 — Idempotency-Key Header Contract

**Headers:**

Request header (client → server):
```
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
```

Response headers (server → client):
```
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
X-Idempotency-Replayed: true   # agar cached javob
X-Idempotency-Replayed: false  # agar yangi bajarish
```

**409 Conflict (same key, different body):**
```json
{
  "detail": "Idempotency-Key conflict: same key used with different request body",
  "code": "IDEMPOTENCY_CONFLICT"
}
```

**Replay semantics:**
- Given: client POST /sale/sales with Idempotency-Key: KEY-001, body={...}
- When: server creates sale successfully → stores response
- Then: second POST with same KEY-001 + same body → HTTP 200 (same status as original), X-Idempotency-Replayed: true, same body
- Given: same KEY-001 but different body → HTTP 409, code=IDEMPOTENCY_CONFLICT

---

### 7.3 T-205 — Inventory Scan Endpoint

**POST /api/v1/warehouse/inventories/{iid}/scan**

Permission: `warehouse.inventory` (mavjud)

Path param: `iid` — UUID

Request body:
```json
{
  "product_id": "uuid",           // REQUIRED
  "qty": 5.0,                     // REQUIRED, > 0
  "barcode_raw": "4600000000001", // OPTIONAL
  "cell_id": "uuid",              // OPTIONAL
  "notes": "string"               // OPTIONAL
}
```

Response 200:
```json
{
  "scan_event_id": 12345,
  "product_id": "550e8400-e29b-41d4-a716-446655440001",
  "actual_qty": "15.000",
  "scan_count": 3,
  "last_scanned_at": "2026-09-05T10:23:00Z"
}
```

Response 404: `{"detail": "Inventory not found"}`

Response 409:
```json
{
  "detail": "Inventarizatsiya allaqachon yakunlangan",
  "code": "INVENTORY_COMPLETED"
}
```

Response 422: `{"detail": "qty must be > 0"}`

---

**DELETE /api/v1/warehouse/inventories/{iid}/scan-events/{event_id}**

Permission: `warehouse.inventory`

Response 200:
```json
{
  "ok": true,
  "product_id": "uuid",
  "actual_qty": "10.000"
}
```

Response 404: `{"detail": "Scan event not found"}`
Response 409: `{"detail": "Cannot void scan on completed inventory"}`

---

**GET /api/v1/warehouse/inventories/{iid}/scan-events**

Permission: `warehouse.inventory`

Query: `product_id` (optional UUID filter), `page`, `limit`

Response 200:
```json
{
  "total": 45,
  "items": [
    {
      "id": 12345,
      "product_id": "uuid",
      "product_name": "string",
      "qty": "5.000",
      "scanned_by": "uuid",
      "scanned_by_name": "string",
      "scanned_at": "2026-09-05T10:23:00Z",
      "cell_id": null,
      "barcode_raw": "4600000000001",
      "is_voided": false
    }
  ]
}
```

---

## 8. Migration Strategy

Barcha o'zgarishlar `apps/api/app/db/schema_patches.py` `PATCHES` list oxiriga qo'shiladi (idempotent, `IF NOT EXISTS`).

**Rollback SQL (agar kerak bo'lsa — manual):**
```sql
-- stock_movements rollback
DROP TRIGGER IF EXISTS trg_stock_movements_immutable ON stock_movements;
DROP FUNCTION IF EXISTS stock_movements_immutable();
DROP TABLE IF EXISTS stock_movements;
DROP INDEX IF EXISTS idx_internal_transfers_correlation;
ALTER TABLE internal_transfers DROP COLUMN IF EXISTS correlation_id;

-- idempotency_keys rollback
DROP TABLE IF EXISTS idempotency_keys;

-- inventory_scan_events rollback
DROP VIEW IF EXISTS inventory_item_actual;
DROP TABLE IF EXISTS inventory_scan_events;
ALTER TABLE inventory_items DROP COLUMN IF EXISTS version;
ALTER TABLE inventory_items DROP COLUMN IF EXISTS scanned_by;
ALTER TABLE inventory_items DROP COLUMN IF EXISTS scanned_at;
-- Note: ALTER TYPE REMOVE VALUE PostgreSQL'da mavjud emas.
-- inventory_status enum rollback: yangi DB dump kerak yoki pg_catalog patch.
```

**Muhim:** `inventory_status` enum'ga yangi qiymatlar qo'shish (`paused`, `pending_confirmation`) rollback qilinmaydi PostgreSQL'da. Bu sprint irreversible DDL change — PM/human tasdiqlashi SHART.

---

## 9. Data Model Summary — Sprint 5 Barcha O'zgarishlar

| Jadval | O'zgarish turi | Yangi ustunlar / Izoh |
|--------|---------------|----------------------|
| `stock_movements` | NEW TABLE | Barcha ustunlar yuqorida |
| `idempotency_keys` | NEW TABLE | Barcha ustunlar yuqorida |
| `inventory_scan_events` | NEW TABLE | Barcha ustunlar yuqorida |
| `internal_transfers` | ALTER ADD | `correlation_id UUID` |
| `inventory_items` | ALTER ADD | `version INT DEFAULT 0`, `scanned_by UUID`, `scanned_at TIMESTAMPTZ` |
| `inventories` | ALTER TYPE + ADD | `is_blind BOOLEAN`, `lock_mode VARCHAR(20)`, enum: `paused`, `pending_confirmation` |
| `cashboxes` | ALTER ADD | `warehouse_id INT REFERENCES warehouses(id)` (T-202) |
| `sale_items` | ALTER ADD | `unit_cost NUMERIC(20,2) DEFAULT 0` (T-201, COGS) |
| `products` | ALTER ADD | `is_archived BOOLEAN DEFAULT FALSE`, `default_supplier_id UUID REFERENCES suppliers(id)` |
| `product_barcodes` | ALTER ADD | `is_primary BOOLEAN DEFAULT FALSE`, `is_active BOOLEAN DEFAULT TRUE`, `added_by UUID`, `added_at TIMESTAMPTZ DEFAULT NOW()` |
| `supplier_returns` | NEW TABLE | (T-210 — PM SPEC'da to'liq; bu DESIGN'da scaffold yo'q) |
| `warehouses` | ALTER ADD | `comment TEXT` |

---

## 10. RBAC Permissions — Sprint 5 Yangi Kodlar

`apps/api/app/modules/rbac/permissions.py` `ALL_PERMISSIONS` ga qo'shiladi:

```python
# Warehouse — stock movements journal
p3("warehouse", "movements", "view"),   # GET /warehouse/movements

# Supplier returns (T-210)
p3("supplier", "return", "create"),
p3("supplier", "return", "confirm"),
p3("supplier", "return", "view"),

# Warehouse — oprihodovanie (posting / incoming adjustment)
p3("warehouse", "posting", "create"),
p3("warehouse", "posting", "view"),

# Sale — change warehouse on existing sale
p3("sale", "warehouse", "change"),

# Inventory — confirm (distinguish from create)
p3("inventory", "confirm", "execute"),
```

`ROLE_GRANTS` yangilanishlar:
- `superadmin`, `admin`: avtomatik (ALL_PERMISSIONS)
- `manager`: `warehouse.movements.view`, `warehouse.posting.create`, `warehouse.posting.view`, `supplier.return.view`, `supplier.return.create`, `inventory.confirm.execute`
- `accountant`: `warehouse.movements.view`, `supplier.return.view`
- `cashier`: hech birortasi yangi permission yo'q

---

## 11. Migration Compatibility — Sprint 1-4

`_stock_apply` signature o'zgargandan keyin 7 ta call site yangilanishi shart. Backend dev bu faylni atomic bir PR da o'zgartiradi:

1. `service.py` — yangi `_stock_apply` implementatsiyasi
2. `warehouse/router.py` — barcha 6 ta call site yangilash
3. `sale/router.py` — sale confirm call site (T-201)

**Compatibility rule:** `org_id` va `operation_type` yangi required parametrlar. Eski default `operation_type="manual"` qo'yilmaydi — barcha call site'lar explicit `operation_type` yuborishi SHART (type safety).

`cost` parametri hozir keyword-only emas — bu saqlanadi. Yangi `operation_type`, `source_type`, `source_id`, `correlation_id`, `user_id` — hammasi keyword-only (`*` dan keyin).

---

## 12. Out of Scope

**SPEC.md WON'T DO (Sprint 5 uchun):**

1. **Real POS offline queue implementation (POS side)** — Idempotency-Key server-side qo'shildi. POS client side: offline queue, retry logic, local storage — bu alohida sprint (mobile team). Sprint 5 faqat server endpoint'larni idempotent qiladi.

2. **Yandex/BTS delivery real integration** — Sprint 4 scaffold saqlanadi. Webhook endpointlar mavjud, lekin real mapping va live testing — Sprint 6.

3. **`partially_received` for internal transfers** — TZ-08 gap aniqlandi (FOUND-DEBT). Sprint 5'da faqat `stock_movements` journal bilan transfers to'g'rilanadi; qisman qabul logikasi Sprint 6.

4. **COGS report endpoint** — `sale_items.unit_cost` ustuni qo'shiladi (T-201), lekin `/statistics/cogs-report` — Sprint 6 statistics sprint'ga qoldirildi.

5. **Inventory `inventory_item_actual` materialized view** — oddiy VIEW qo'shiladi. Materialized view refresh strategiyasi (pg_cron yoki trigger-based) — performance sprint'ga.

6. **`inventory_scan_events` → real-time push (WebSocket/SSE)** — Poll-based (har 3s GET scan-events). Real-time multi-user sync — infrastructure sprint'ga.

7. **`supplier_returns` to'liq DDL** — T-210 PM SPEC'da. DESIGN-5 faqat permission code'larini belgilaydi; DDL PM SPEC'dan dev'ga o'tadi.

---

## 13. Clarifications Section

_(Append-only. Har entry dated.)_

_(Bo'sh — hech qanday clarification yo'q sprint boshida)_

---

## Verification — Backend → Frontend Trace

### stock_movements GET
- Backend `Decimal` → `str` (JSON serializer `str(decimal)`) → Frontend `string` field `"before_qty": "100.000"`
- Frontend `parseFloat("100.000")` yoki display as-is — OK

### inventory scan POST response
- `actual_qty: "15.000"` — string (Decimal serialized). Frontend: `Number(actual_qty)` for display. TS type: `qty: string`.
- `scan_event_id: 12345` — BIGSERIAL → number. TS type: `id: number`. OK (JS safe integer uchun 2^53 yetarli).

### idempotency replay
- `X-Idempotency-Replayed: "true"` — header string. Frontend axios interceptor: `response.headers['x-idempotency-replayed']`. OK.
- 409 `code` field — frontend `getErrorMessage` helper handles `e.response.data.detail`. `code` field alohida handle qilinadi agar POS logika kerak bo'lsa.

---

> **FREEZE LINE** — Section 7 (API Contract) o'zgartirilmaydi. Har o'zgarish → `tickets/QUESTIONS.md` → PM eskalatsiya.
