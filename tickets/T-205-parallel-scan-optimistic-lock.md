# T-205 — Parallel Scan Optimistic Lock + Concurrent User Protection

**Owner Role**: backend-dev
**Depends On**: T-204 (inventory_items.version ustuni T-204 schema'sida qo'shiladi)
**Blocks**: none
**Estimated Size**: M (1-3 kun)
**Priority**: P0
**TZ Reference**: TZ-12

---

## Rationale

Bir nechta xodim bir vaqtda inventarizatsiya kiritsa (masalan 3 kishi parallel skanerlaydi), "last write wins" muammosi yuzaga keladi: birinchi xodim 10 ta kiritsа, ikkinchisi shu vaqtda 5 ta kiritsа, natijada 5 ta qoladi — 10 ta yo'qoladi. Optimistic locking bu muammoni hal qiladi: har yangilash chog'ida client o'zi o'qigan `version`ni yuboradi; agar DB da version o'zgargan bo'lsa — 409 Conflict qaytariladi, client yangilangan ma'lumotni olib qayta urinadi.

---

## Files Likely Touched

- **Backend**: `apps/api/app/modules/warehouse/router.py` — `PATCH /warehouse/inventory-items/{id}` endpoint
- **DB**: T-204 tomonidan `inventory_items.version INT DEFAULT 0` allaqachon qo'shilgan (bu ticket faqat endpoint logikasini yozadi)
- **Tests**: `apps/api/tests/test_inventory_optimistic_lock.py`

---

## Acceptance Criteria

### Endpoint
- [ ] `PATCH /warehouse/inventory-items/{id}` — mavjud endpoint'ni kengaytirish yoki yangi qo'shish
- [ ] Request body: `{actual_qty: float, expected_version: int}` — `expected_version` majburiy maydon
- [ ] Jarayon:
  1. `SELECT id, actual_qty, version FROM inventory_items WHERE id = :id AND organization_id = :o FOR UPDATE` — row lock
  2. Agar `row.version != expected_version` → 409 Conflict `{"detail": "Conflict: another user updated this item. Please refresh and retry.", "current_version": row.version}`
  3. Agar mos → `UPDATE inventory_items SET actual_qty = :qty, version = version + 1 WHERE id = :id`
  4. Response: yangilangan `{id, actual_qty, version}` qaytariladi
- [ ] `GET /warehouse/inventories/{id}/items` response'da har item uchun `version` maydoni mavjud
- [ ] Endpoint `warehouse.manage_inventory` yoki `warehouse.manage_inventory_advanced` permission talab qiladi

### Concurrent Test
- [ ] `test_inventory_optimistic_lock.py`: ikkita parallel request biri boshqasidan keyin kelsa — birinchisi 200, ikkinchisi 409 qaytaradi
- [ ] `test_inventory_optimistic_lock.py`: 409 olinganda `current_version` javobda mavjud, client qayta urinsa (yangi `expected_version` bilan) — 200 qaytaradi
- [ ] `test_inventory_optimistic_lock.py`: noto'g'ri `organization_id` bilan request → 403/404

---

## Technical Notes

- `FOR UPDATE` lock — bu short-lived transaksiya, timeout muammosi yo'q.
- **Antipattern**: `SELECT` va `UPDATE` orasida Python darajasida version tekshirmang — DB level `WHERE version = :ev` yoki `FOR UPDATE` bilan qiling, aks holda TOCTOU race condition.
- Ideal pattern:
  ```sql
  UPDATE inventory_items
  SET actual_qty = :qty, version = version + 1
  WHERE id = :id AND version = :ev AND organization_id = :o
  RETURNING id, actual_qty, version
  ```
  Agar `rowcount == 0` → SELECT qilib qayta tekshirish: mavjud emas (404) yoki version mismatch (409).
- Client (frontend) bu ticketda O'ZGARMAYDI — faqat backend. Frontend T-205 dan keyin alohida ticketda yangilanadi (Wave 5C).
- `inventory_items`da `organization_id` ustuni mavjudligini tekshiring — yo'q bo'lsa query'da `JOIN inventories` orqali filter qiling.

---

## Definition of Done

- [ ] Mechanical: `pytest apps/api/tests/test_inventory_optimistic_lock.py -v` — 0 fail
- [ ] Mechanical: barcha avvalgi testlar regression yo'q
- [ ] Agentic: qa-reviewer BLOCKER yo'q
- [ ] Behavioral: Postman yoki httpie bilan ikkita parallel PATCH — biri 409 oladi
- [ ] Human-gate: merge
