# T-211 — Legacy transfers Deprecation + internal_transfers'ga Migratsiya

**Owner Role**: backend-dev
**Depends On**: none (lekin barcha boshqa ticketlar stable bo'lganda — Wave 5D)
**Blocks**: none
**Estimated Size**: M (1-3 kun)
**Priority**: P0
**TZ Reference**: Cross-cutting (cleanup)

---

## Rationale

Sprint 0'da `transfers` jadvali yaratilgan, Sprint 2'da `internal_transfers` (yangi, to'liq) qo'shilgan. Hozirda ikkalasi parallel mavjud — kod ikki joyda qo'llab-quvvatlanadi, bu xato manbai va chalkashlik keltirib chiqaradi. Frontend'da qaysi endpoint'dan foydalanish noaniq. `transfers` eski arxitektura bo'lib, `internal_transfers` to'liq uning o'rnini bosadi. Bu ticket eski jadvalni arxivlaydi va API 410 Gone qaytaradi.

---

## Files Likely Touched

- **DB**: `apps/api/app/db/schema_patches.py` — data migration SQL, eski jadval rename/archive
- **Backend**: `apps/api/app/modules/warehouse/router.py` — eski `/warehouse/transfers` endpoint'lari 410 qaytarish
- **Frontend**: barcha `(dashboard)/warehouse/internal-transfers/` sahifalari — `/transfers/*` qoldig'i yo'q
- **Docs**: `LESSONS.md` — migration note
- **Tests**: `apps/api/tests/test_transfers_deprecated.py`

---

## Acceptance Criteria

### Data Migration
- [ ] `schema_patches.py`da idempotent migration patch:
  ```sql
  INSERT INTO internal_transfers (
    organization_id, from_warehouse_id, to_warehouse_id,
    doc_number, status, notes, created_by, created_at
  )
  SELECT organization_id, from_warehouse_id, to_warehouse_id,
         doc_number, status, notes, created_by, created_at
  FROM transfers
  WHERE id NOT IN (
    SELECT source_legacy_id FROM internal_transfers
    WHERE source_legacy_id IS NOT NULL
  )
  ```
  Buning uchun `internal_transfers.source_legacy_id UUID NULLABLE` ustun qo'shilishi mumkin (tracking uchun)
- [ ] Items ham migratsiya: `internal_transfer_items` ga `transfer_items` dan ko'chiriladi
- [ ] Migration idempotent — qayta ishlaganda dublikat yaratmaydi

### API Deprecation
- [ ] `GET /warehouse/transfers` → 410 Gone, response: `{"detail": "This endpoint is deprecated. Use /warehouse/internal-transfers instead."}`
- [ ] `POST /warehouse/transfers` → 410 Gone
- [ ] `GET /warehouse/transfers/{id}` → 410 Gone
- [ ] Barcha boshqa `/warehouse/transfers/*` path'lar → 410 Gone
- [ ] Frontend'da `grep -r "/transfers" apps/web/app` — faqat `internal-transfers` qolishi kerak, `/api/warehouse/transfers` chaqiruvi 0 bo'lishi

### Frontend Cleanup
- [ ] `grep -rn "warehouse/transfers" apps/web/` — `internal-transfers` bo'lmagan result yo'q
- [ ] `lib/api.ts` yoki boshqa joylarda `transfers` endpoint URL'lari yo'q
- [ ] Menu'da `transfers` link yo'q (agar mavjud bo'lsa o'chirilib `internal-transfers` bilan almashtirilgan)

### Jadval Arxivi (ixtiyoriy, lekin tavsiya)
- [ ] Agar migratsiya to'liq tasdiqlangan bo'lsa: `ALTER TABLE transfers RENAME TO transfers_deprecated_sprint5` — DROP emas, arxiv
- [ ] Yoki: `transfers` jadvali saqlanib qoladi, lekin API endpoint'lari 410

### LESSONS.md
- [ ] Sprint 5 da `transfers` → `internal_transfers` migratsiya note qo'shilgan

### Tests
- [ ] `test_transfers_deprecated.py`: `GET /warehouse/transfers` → 410
- [ ] `test_transfers_deprecated.py`: `POST /warehouse/transfers` → 410
- [ ] `test_transfers_deprecated.py`: `GET /warehouse/internal-transfers` — ishlaydi (regression)

---

## Technical Notes

- **Antipattern**: `transfers` jadvalini hoziroq `DROP TABLE` qilmang — migratsiya xatoliklari bo'lsa ma'lumot yo'qolishi mumkin. Rename yoki "deprecated" flag bilan 1 sprint saqlang.
- `internal_transfers` schema'sida `from_warehouse_id` va `to_warehouse_id` mavjudligini tekshiring — eski `transfers`da farqli nom bo'lishi mumkin (migration SQL'ni moslashtiring).
- 410 Gone eski 301/302 Redirect'dan afzal — client kutilmagan yo'naltirishga tushib qolmaydi.
- Agar `transfers`'ga reference qiluvchi boshqa jadvallar mavjud bo'lsa (FK) — avval ularni `internal_transfers`'ga yo'naltiring.
- `source_legacy_id` ustuni T-211'ga xos — boshqa sprint'larda ishlatilmaydi.

---

## Definition of Done

- [ ] Mechanical: `pytest apps/api/tests/test_transfers_deprecated.py -v` — 0 fail
- [ ] Mechanical: `grep -rn "api/warehouse/transfers" apps/web/` — 0 natija
- [ ] Mechanical: barcha avvalgi `internal-transfers` testlar regression yo'q
- [ ] Agentic: qa-reviewer BLOCKER yo'q
- [ ] Behavioral: eski `/transfers` URL'ni browserdan ochish → 410 xabari; `/internal-transfers` ishlaydi
- [ ] Human-gate: merge + LESSONS.md update tasdiqlangan
