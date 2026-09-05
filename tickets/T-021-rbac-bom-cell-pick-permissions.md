# T-021 — RBAC: New permission codes for BOM, Cells, Pick

**Owner**: backend-dev
**Size**: S
**Depends on**: none (parallel with T-020)

---

## Goal

Register new permission codes for BOM, warehouse cells, and pick workflow in `permissions.py` and grant them to appropriate system roles. Printer permission codes are NOT added.

---

## Files likely touched

- `apps/api/app/modules/rbac/permissions.py` — `ALL_PERMISSIONS` list + `ROLE_GRANTS`

---

## Acceptance criteria

- [ ] `warehouse.bom.view` and `warehouse.bom.manage` added using `p3("warehouse","bom","view")` / `p3("warehouse","bom","manage")`
- [ ] `warehouse.cell.view` and `warehouse.cell.manage` added using `p3("warehouse","cell","view")` / `p3("warehouse","cell","manage")`
- [ ] `order.pick.view`, `order.pick.execute`, and `order.pick.contact` added using `p3("order","pick","view")` etc.
- [ ] No `warehouse.printer.*` permission codes are added
- [ ] Grants: `superadmin` and `admin` get all new permissions; `manager` gets view+manage for BOM and cell; `cashier` gets `order.pick.view` and `order.pick.contact`; `picker` role (or `viewer` if picker does not exist) gets `order.pick.view` + `order.pick.execute` + `order.pick.contact`
- [ ] No existing permission codes modified or removed
- [ ] Backend import of `permissions.py` succeeds; `docker compose restart api` is clean

---

## Notes

`picker` role may not exist as a system role today. If adding it: insert into `ROLE_GRANTS` dict only — do not modify DB roles table directly. Confirm with T-002 pattern. See `apps/api/app/modules/rbac/permissions.py` for `p3` helper usage.
