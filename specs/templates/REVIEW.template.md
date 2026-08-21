# REVIEW — <feature name> (YYYY-MM-DD)

> QA Reviewer tomonidan yoziladi (oxirgi builder dan keyin).
> Format: `qa-reviewer.md` agent kartasiga qarang.

## Tekshirilgan sprint

- SPEC: `tickets/SPEC.md` (yoki archive yo'l)
- DESIGN: `tickets/DESIGN.md`
- Tickets: T-1, T-2, T-3 (har biriga bitta diff)

## BLOCKER (N)

(0 ham OK — clean review)

- **<short description>** at `apps/api/app/modules/warehouse/router.py:215`
  Why it blocks: Multi-tenant filter yo'q — Org B mahsulotini ham qaytaradi
  Suggested fix:
  ```python
  text("SELECT ... WHERE organization_id = :o AND mxik = :m"),
  {"o": org_id, "m": mxik}
  ```

## MAJOR (N)

- **<short description>** at `apps/web/app/(dashboard)/warehouse/products/page.tsx:88`
  ...

## MINOR (N)

- ...

## Verified safe (notes)

[Audit tool noto'g'ri flag qilgan, lekin tekshiruvda xavfsiz patternlar]

- `text(f"... {where_sql} ...")` in `warehouse/router.py:225` — false positive. `where_sql` faqat hardcoded fragmentlardan; user qiymatlari bound (`:o`, `:m`).

## 4 qatlamli tekshirish narvoni

- [x] **Mechanical**: hookalar va testlar o'tdi
- [x] **Agentic**: BLOCKER = 0
- [ ] **Behavioral**: E2E smoke test odam tomonidan (siz)
- [ ] **Human-gate**: PR approve (siz)

## Tavsiya

[ ] Merge'ga tayyor
[ ] Yo'q — quyidagi BLOCKER hal qilinsin: ...

## Imzo

QA Reviewer: qa-reviewer agent
Sana: YYYY-MM-DD HH:MM UTC
