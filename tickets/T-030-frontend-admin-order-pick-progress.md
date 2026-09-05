# T-030 — Frontend: Admin order pick progress (desktop)

**Owner**: frontend-dev
**Size**: M
**Depends on**: T-025

---

## Goal

Add pick progress badge + progress bar to the admin order list, and per-item pick status + cashier contact audit to the order detail page.

---

## Files likely touched

- `apps/web/app/(dashboard)/sales/orders/page.tsx` — add `n/total` badge and progress bar to each order row
- `apps/web/app/(dashboard)/sales/orders/[id]/page.tsx` — add pick status column to items table + audit trail section
- `apps/web/i18n/messages/uz.json`, `ru.json`, `en.json`, `uz-cyrl.json`

---

## Acceptance criteria

### Order list
- [ ] Each order row/card shows a pick progress badge: `{picked_count}/{total_items}` in a small badge (gray if 0, amber if partial, emerald if fully picked)
- [ ] Below the badge: a thin progress bar (`h-1` or `h-1.5`) that fills left-to-right proportionally, emerald fill color
- [ ] Badge and bar are hidden (or show 0/0) if `total_items = 0` (order has no pick data yet)
- [ ] Desktop table: badge fits in a new `Yig'ish` column; mobile card: badge appears below customer name
- [ ] Data fetched as part of the existing order list API (backend should include `picked_count` and `total_items` in list response — coordinate with T-025 to include these fields)

### Order detail
- [ ] Items table has a new `Holat` column: shows `Topildi` (emerald badge), `Topilmadi` (rose badge), or `Kutilmoqda` (gray badge) per item, driven by `order_pick_items` status
- [ ] Below the items table: "Murojaat tarixi" (Contact history) section — shows `order_pick_messages` as a timeline: `{from_user_name}` — `{kind icon}` — `{body}` — `{created_at}`; kind=call shows a phone icon, kind=message shows a chat bubble icon
- [ ] "Murojaat tarixi" section is hidden if no messages exist for the order
- [ ] Auto-refresh: detail page polls `GET /orders/{oid}/pick` every 15 seconds to update statuses and progress (add a small "so'nggi yangilanish" timestamp label); include a comment in code: `// TODO: replace polling with WebSocket`
- [ ] Visible only to users with `order.pick.view` permission; entire pick section hidden otherwise
- [ ] 4 i18n languages covered

---

## Notes

Do not rebuild the entire order list or detail page — add the pick data as additive columns/sections. If the items table is a shared component, extend it via props rather than duplicating it.
