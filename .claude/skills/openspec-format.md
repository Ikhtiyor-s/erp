---
name: openspec-format
description: OpenSpec aylanasi (propose → apply → archive), RFC 2119 (MUST/SHOULD/MAY), Given/When/Then (BDD) format. Use when writing SPEC.md, DESIGN.md, or planning a new sprint.
---

# OpenSpec format (Aniq ERP)

## Aylana

```
PROPOSE         APPLY              ARCHIVE
SPEC.md   →    kod o'zgaradi  →   specs/archive/YYYY-MM-DD-<slug>/
T-*.md         testlar              SPEC.md, DESIGN.md, T-*.md, REVIEW.md ko'chiriladi
DESIGN.md      hooklar ishlaydi
                                   canonical specs/MODULE.md ga delta birlashadi
```

## SPEC.md format (PROPOSE bosqichi)

### Sarlavhalar (qattiq)

```markdown
# SPEC — <feature name> (YYYY-MM-DD)

## Niyat
Bir abzats: muammo, kim uchun, nega hozir.

## Tegishli foydalanuvchi
Aniq role(s): admin, manager, kassir, mijoz, agent, ...

## Acceptance criteria (Given/When/Then)
Quyidagi BDD format'da har bir asosiy scenario uchun:

**Scenario 1: <happy path>**
- **Given** boshlanish holati (ma'lumotlar, foydalanuvchi role'i, kontekst)
- **When** foydalanuvchi nima qiladi
- **Then** sistema qanday javob berishi shart

**Scenario 2: <negative case>**
- **Given** ...
- **When** ...
- **Then** ...

(Hech bo'lmaganda 1 happy path + 1 negative + 1 cross-tenant boundary)

## Talablar (RFC 2119)
- **MUST**: Sistema X qila olishi shart
- **MUST NOT**: Sistema Y qilmasligi shart
- **SHOULD**: Sistema Z qilishi tavsiya etiladi
- **MAY**: Sistema W ham qila olishi mumkin

## QILMAYMIZ (qamrov-tashqarisida)
Aniq ro'yxat:
- ❌ Feature X — keyingi sprintda
- ❌ Feature Y — alohida talab
- ❌ Architecture rewrite — refactor emas

## Rollback rejasi
Agar muammoga uchrasak, qanday qaytaramiz:
- DB: migratsiya qaytarib bo'ladimi yoki forward-only?
- Code: revert kerakmi yoki feature flag bilan o'chirib qo'yiladimi?
- User-facing: yangi UI element yashiriladimi yoki butunlay o'chiriladimi?

## Tegishli modullar
- `apps/api/app/modules/X/` — yangi endpoint
- `apps/web/app/(dashboard)/Y/page.tsx` — yangi UI
- `apps/api/app/db/schema_patches.py` — yangi indeks

## O'zbek bozori xosligi (agar tegishli bo'lsa)
- OFD: ✗ tegmaydi / ✓ tegadi (qanday)
- MXIK: ...
- QQS: ...
- TIN/STIR: ...
- SMS (Eskiz): ...
- To'lov (Click/Payme): ...
```

### RFC 2119 atamalari (qattiq ta'rif)

| Atama | Ma'no | Misol |
|---|---|---|
| **MUST** | Talab. Buzilishi mumkin emas. | "API MUST filter by organization_id" |
| **MUST NOT** | Taqiq. | "Audit log MUST NOT contain plaintext passwords" |
| **SHOULD** | Kuchli tavsiya. Asoslangan istisno mumkin. | "Frontend SHOULD cache product list for 60s" |
| **SHOULD NOT** | Kuchli ogohlantirish. | "Endpoint SHOULD NOT return more than 200 items per page" |
| **MAY** | Ixtiyoriy. | "Client MAY include X-Trace-Id header" |

### Given/When/Then (BDD)

```markdown
**Scenario: Admin invites existing user — invitation flow**
- **Given** Admin A is logged in as `admin` in Org A
- **And** user@example.com is registered in Org B
- **When** Admin A POSTs to /rbac/users/invite with that email
- **Then** the response includes `invitation_token` (NOT user_id)
- **And** the user is NOT immediately added to Org A
- **And** the invitation appears in user@example.com's GET /rbac/invitations/mine
```

## T-*.md format (ticket)

```markdown
# T-<n> — <slug>

## Goal
One sentence — what this ticket delivers.

## Acceptance criteria
- Concrete test or manual check
- Bullet list, each verifiable

## Files likely touched
- `path/to/file1.py`
- `path/to/file2.tsx`

## Owner role
`backend-dev` | `frontend-dev` | `architect`

## Depends on
`T-1`, `T-3`  | `none`

## Estimated effort
S (< 30 min) | M (1-3 hours) | L (half day) | XL (full day+)
```

## DESIGN.md format (architect output)

```markdown
# DESIGN — <feature name>

## Yondashuv
1 abzats: tanlangan approach + nega + rad etilgan alternativalar (bir qatorda).

## Fayl tuzilishi
- New: `apps/api/app/modules/X/router.py` (+150 lines)
- Edit: `apps/api/app/db/schema_patches.py` (+15 lines patch)
- Edit: `apps/web/app/(dashboard)/X/page.tsx` (+200 lines)
- Edit: `apps/web/lib/menu.config.ts` (+1 line — new menu entry)

## DB o'zgarishlari
```sql
ALTER TABLE products ADD COLUMN IF NOT EXISTS mxik VARCHAR(20);
CREATE INDEX IF NOT EXISTS idx_products_mxik ON products (mxik) WHERE mxik IS NOT NULL;
```
- Multi-tenant: `products.organization_id` allaqachon bor — yangi columnga ham implicit'cha tegishli
- Migration safety: ADD COLUMN NULLABLE → instant lock-free

## API kontrakti (full-stack uchun MUZLATILGAN)
**POST /api/v1/warehouse/products** — request body:
```json
{ "name": "string", "sku": "string", "mxik": "string|null", ... }
```
Response:
```json
{ "id": "uuid", "mxik": "string|null", ... }
```
Errors: 422 (validation), 409 (duplicate sku within org)

## RBAC
- `POST /warehouse/products` → `warehouse.create` (mavjud)
- `GET /warehouse/products?mxik=...` → `warehouse.view` (mavjud)
- Yangi permission shart EMAS.

## Xavfsizlik
- Trifecta risk: yo'q (MXIK code public reference number, sir emas)
- Tashqi validatsiya kerakmi (mxik.uz API)? — SPEC'da out-of-scope, lokal regex bilan tekshiriladi
```

## ARCHIVE bosqichi (sprint tugagandan keyin)

1. `tickets/` dagi barcha sprint fayllari (`SPEC.md`, `DESIGN.md`, `T-*.md`) `specs/archive/YYYY-MM-DD-<slug>/` ga ko'chiriladi
2. `REVIEW.md` yoziladi: qa-reviewer'ning oxirgi tasdig'i + odam imzosi
3. Agar bu yangi modul edi — `specs/MODULE.md` (canonical) yaratiladi yoki yangilanadi
4. `tickets/` toza bo'lishi kerak keyingi sprint uchun

`LESSONS.md` ga sprint xulosasi: nima ishladi / nima ishlamadi / keyingi safar nimani o'zgartirish.

## Validation (yozishdan keyin)

- [ ] QILMAYMIZ ro'yxati bor (kamida 3 ta)
- [ ] Acceptance criteria BDD format (Given/When/Then)
- [ ] Multi-tenant cross-tenant test scenario bor
- [ ] Rollback plan aniq
- [ ] RFC 2119 atamalari to'g'ri ishlatilgan (MUST != SHOULD)
- [ ] O'zbek bozori xosligi tekshirilgan
