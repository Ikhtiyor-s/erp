# T-204 — Inventory Rich States (paused, pending_confirmation) + State Machine

**Owner Role**: backend-dev
**Depends On**: T-200 (stock_movements journal — inventory_adjust yozuvi uchun)
**Blocks**: T-205 (optimistic lock T-204 schema'siga tayanadi)
**Estimated Size**: M (1-3 kun)
**Priority**: P0
**TZ Reference**: TZ-12

---

## Rationale

Hozirda `inventories.status` faqat `draft`, `in_progress`, `completed`, `cancelled` qiymatlarini biladi. Yirik omborlarda inventarizatsiya bir kunda tugamaydi — to'xtatish va qayta davom ettirish kerak. Shuningdek, barcha tekshiruvlar bitgach hisobchi tasdiqlashi lozim. Bu ikki holat (`paused`, `pending_confirmation`) va tegishli endpoint'lar yo'qligi inventarizatsiya jarayonini bloklaydi. `blind_count` (ko'r rejim) va parallel skanerlash uchun `inventory_scan_events` jadvali ham shu ticketda yaratiladi.

---

## Files Likely Touched

- **DB**: `apps/api/app/db/schema_patches.py` — enum kengaytirish, yangi ustunlar, `inventory_scan_events` jadval
- **Backend**: `apps/api/app/modules/warehouse/router.py` — yangi state-change endpoint'lar
- **RBAC**: `apps/api/app/modules/rbac/permissions.py` — `warehouse.manage_inventory_advanced`
- **RBAC seed**: `apps/api/app/modules/rbac/seed.py`
- **Tests**: `apps/api/tests/test_inventory_rich_states.py`

---

## Acceptance Criteria

### DB Schema
- [ ] `ALTER TYPE inventory_status ADD VALUE IF NOT EXISTS 'paused'` — idempotent patch
- [ ] `ALTER TYPE inventory_status ADD VALUE IF NOT EXISTS 'pending_confirmation'` — idempotent patch
- [ ] `inventories.blind_count BOOLEAN DEFAULT FALSE` — `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
- [ ] `inventories.lock_mode VARCHAR(20) DEFAULT 'none'` — `none | soft | hard` (kelgusida)
- [ ] `inventory_scan_events(id UUID PK, organization_id UUID NOT NULL, inventory_id UUID NOT NULL FK inventories, user_id UUID FK users, product_id UUID FK products, qty NUMERIC(20,3) NOT NULL, scanned_at TIMESTAMPTZ DEFAULT NOW())` — yangi jadval
- [ ] Index: `(organization_id, inventory_id, scanned_at DESC)`
- [ ] `inventory_items.version INT NOT NULL DEFAULT 0` — `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (T-205 uchun tayyorlik)

### State Machine (qattiq)
Ruxsat etilgan o'tishlar:
```
draft → in_progress
in_progress → paused
paused → in_progress
in_progress → pending_confirmation
pending_confirmation → completed
pending_confirmation → in_progress  (reject, qayta olib ketish)
in_progress → cancelled
draft → cancelled
```
Boshqa o'tishlar → 422 "Invalid state transition"

### Backend Endpoints
- [ ] `POST /warehouse/inventories/{id}/pause` — `in_progress → paused`; boshqa holatdan → 422
- [ ] `POST /warehouse/inventories/{id}/resume` — `paused → in_progress`
- [ ] `POST /warehouse/inventories/{id}/submit` — `in_progress → pending_confirmation`
- [ ] `POST /warehouse/inventories/{id}/confirm` — `pending_confirmation → completed`; `stock_balances` yangilanadi + `stock_movements` INSERT (`operation_type="inventory_adjust"`) — T-200 integratsiya
- [ ] `POST /warehouse/inventories/{id}/reject` — `pending_confirmation → in_progress` (boshqaruv qayta beradi)
- [ ] `POST /warehouse/inventories/{id}/cancel` — `draft|in_progress → cancelled`
- [ ] `POST /warehouse/inventories/{id}/scan-events` body: `{product_id, qty}` — `inventory_scan_events`ga INSERT; `inventory_items.actual_qty` oshiriladi
- [ ] Barcha endpoint'lar `organization_id` tekshiruvi bilan
- [ ] `warehouse.manage_inventory_advanced` permission: manager, admin

### blind_count
- [ ] Inventarizatsiya `blind_count=TRUE` bilan yaratilsa, `GET /warehouse/inventories/{id}/items` response'da `expected_qty` null qaytaradi (UI'da ko'rinmaydi)

### Tests
- [ ] `test_inventory_rich_states.py`: `draft → in_progress → paused → in_progress → pending_confirmation → completed` to'liq zanjir
- [ ] `test_inventory_rich_states.py`: noto'g'ri o'tish (masalan `paused → completed`) → 422
- [ ] `test_inventory_rich_states.py`: confirm → `stock_movements`da `inventory_adjust` yozuvi paydo bo'ladi (T-200 bilan birga)
- [ ] `test_inventory_rich_states.py`: scan_event POST → `inventory_items.actual_qty` yangilanadi

---

## Technical Notes

- PostgreSQL enum'ga `ADD VALUE IF NOT EXISTS` faqat transaksiyasiz (auto-commit) ishlatilishi mumkin — `schema_patches.py`da COMMIT ga ehtiyoj bo'lsa alohida `COMMIT` yoki `isolation_level='AUTOCOMMIT'` ishlatiladi.
- **Antipattern**: enum o'rniga `CHECK CONSTRAINT` ishlatmang — mavjud `inventory_status` enum kengaytiriladi.
- `confirm` endpoint'ida `stock_balances` yangilanishi va `stock_movements` INSERT'i bitta transaksiyada — T-200 `_stock_apply` orqali, qo'lda SQL yozmang.
- `inventory_scan_events` — append-only, DELETE yo'q (T-200 kabi trigger shart emas, lekin endpoint level'da DELETE endpoint yaratmang).
- `lock_mode` bu ticketda faqat schema'da qo'shiladi, business logic keyinchalik.

---

## Definition of Done

- [ ] Mechanical: `pytest apps/api/tests/test_inventory_rich_states.py -v` — 0 fail
- [ ] Mechanical: `psql -c "\dT inventory_status"` — `paused` va `pending_confirmation` ko'rinadi
- [ ] Agentic: qa-reviewer BLOCKER yo'q
- [ ] Behavioral: manual smoke — inventarizatsiya yaratib, pause, resume, submit, confirm — har qadam to'g'ri status
- [ ] Human-gate: merge
