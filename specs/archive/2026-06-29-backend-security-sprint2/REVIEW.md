# REVIEW - 2026-06-29-backend-security-sprint2

**Sprint**: Backend xavfsizlik mustahkamlash - 4 CRITICAL + 7 HIGH topilmalarni hal qilish
**QA reviewer**: qa-reviewer agent (READ-ONLY, Read/Grep/Glob only) - cycle 2-dan boshlab
**Total cycles**: 4 (1 cto self-review + 1 qa independent + 1 backend-dev iteration + 1 cast cleanup)
**Final verdict**: APPROVED (0 BLOCKER / 0 MAJOR / 0 MINOR)

## Tickets in scope

| Ticket | Owner | Scope | Final status |
|---|---|---|---|
| T-1-rbac-middleware-fix | backend-dev | CR-1: PermissionMiddleware fail-CLOSED, SKIP_PATHS toraytirish, audit | Merged (1 cycle) |
| T-2-reference-superadmin-guard | backend-dev | CR-4: currencies/units mutations faqat superadmin | Merged (1 cycle) |
| T-3-cross-tenant-entity-checks | backend-dev | CR-2 + CR-3: sale/finance cross-tenant warehouse/product/cashbox check | Merged (3 cycles) |
| T-4-import-register-fixes | backend-dev | HI-1 + HI-2: import_customers chunked rollback, register org-scoped role klon | Merged (1 cycle) |
| T-5-privilege-escalation-guard | backend-dev | HI-6: update_role_permissions caller-owns-permission tekshiruvi | Merged (2 cycles) |
| T-6-otp-phone-normalize | backend-dev | HI-7: telefon normalize qatiy ValueError, OTP try/except 422, SQL exact match (LIKE olib tashlandi) | Merged (1 cycle) |
| T-7-security-tests | backend-dev | 14 yangi test (4 unit + 10 integration) | Merged (2 cycles) |

## QA cycle history

### Cycle 1 - CTO self-review (MAST anti-pattern qayd qilindi)

Bu sessiyada Agent tool dispatching mavjud emas edi, shuning uchun cto orchestrator ozi yozdi va ozi tekshirdi.
46 test PASS bolib korindi, lekin **writer = reviewer** birlashishi MAST anti-pattern ni ifodalaydi
(CLAUDE.md 5 validatsiya savoli #4: Reviewer != writer). Bu xatar LESSONS.md ga qayd qilindi.

Cycle 1 oxirida: 46 passed, 1 skipped, 0 failed - lekin verification independent emas.

### Cycle 2 - QA independent review (3 BLOCKER + 4 MAJOR)

Sessiyada qa-reviewer agent alohida dispatch qilindi (READ-ONLY: Read/Grep/Glob). Topgani:

**BLOCKERs:**

1. **BLOCKER (T-3)**: pay_sale cashbox organization_id tekshiruvi yoq edi - boshqa tenant cashbox iga tolov qilish imkoni qoldi. CR-3 toliq yopilmagan.
2. **BLOCKER (T-5)**: update_role_permissions da superadmin caller exempt edi, lekin **nomalum permission_id** bilan request kelganda 500 qaytadi (silent ignore orniga 400 bolishi kerak). HI-6 qisman.
3. **BLOCKER (T-1)**: PermissionMiddleware SKIP_PATHS hali /api/audit ni oz ichiga olardi - audit modul ining bazi endpoint lari (export) auth orqali himoyalanishi kerak edi.

**MAJORs:**

1. **MAJOR (T-3)**: create_movement cashbox cross-tenant check borligi tasdiqlandi, lekin error message tenant ID sini leak qilardi - 404 not found orniga 403 not in your org chiqqan (axborot oqishi).
2. **MAJOR (T-6)**: _normalize_phone ValueError chiqaradi, lekin register endpoint try/except qoymagan - 500 qaytadi 422 orniga.
3. **MAJOR (sale dashboard)**: sale_date::date cast 2 ta joyda hali bor (T-3 patch ichida bittasini tuzatdik, lekin sales_dashboard aggregate query da qoldi) - indexsiz scan, CLAUDE.md anti-pattern.
4. **MAJOR (T-7)**: auth_token fixture session-scope, lekin har test alohida user yaratardi - DB seed qoshildi lekin teardown yoq. Test isolation zaif.

backend-dev ga qaytarildi: shu 3 BLOCKER + 4 MAJOR ni tuzating, boshqasiga tegmang.

### Cycle 3 - backend-dev 7 ta fix, 1 qoldiq BLOCKER

backend-dev cycle 2 royxatining 7/8 ni tuzatdi:

- pay_sale cashbox tenant check qoshildi (WHERE id = :cb AND organization_id = :o)
- update_role_permissions nomalum permission_id uchun 400 + audit log
- SKIP_PATHS /api/audit olib tashlandi
- error message tenant leak fix - 404 not found ga ozgartirildi
- register try/except ValueError -> 422
- auth_token fixture teardown qoshildi
- _normalize_phone qatiy regex

**Qoldiq BLOCKER (yangi topildi)**: sales_dashboard aggregate query da hali sale_date::date cast bor -
backend-dev cycle 2 da boshqa joyda fix qilgan, lekin dashboard query da xato qoldirdi.
qa-reviewer Grep ishlatib loyiha boyicha ::date pattern ini qidirdi va sale/router.py:sales_dashboard
qatorida topdi. Bu MAST lost handoff anti-pattern (T-3 ticket ida butun faylda Grep qilish topshirilishi kerak edi).

### Cycle 4 - final cast cleanup, APPROVED

backend-dev sale_date::date cast ni indeks-friendly pattern ga ozgartirdi:
sale_date >= :df AND sale_date < (:dt::date + INTERVAL 1 day).
Boshqa joylarda Grep qildi - yana qoldiq topilmadi.

qa-reviewer re-review: 0 BLOCKER, 0 MAJOR, 0 MINOR. **APPROVED.**

## Behavioral check (cto integration)

- docker compose restart api muvaffaqiyatli
- docker exec erp-api pytest apps/api/tests/ -v gives 49 passed, 1 skipped, 0 failed
  - Skipped: OTP integratsion test (rate-limit 3/min unit test bilan qoplanadi)
- Manual smoke:
  - POST /api/sale/sales boshqa tenant warehouse_id bilan -> 404 (cross-tenant block)
  - POST /api/reference/currencies oddiy admin token bilan -> 403 (superadmin guard)
  - POST /api/auth/register +12345 telefon bilan -> 422 ValueError (normalize)
  - PUT /api/rbac/roles/{id}/permissions nomalum permission_id -> 400 (T-5 fix)

## Files changed (sprint snapshot)

Production code:
- apps/api/app/modules/rbac/middleware.py (T-1: fail-CLOSED 503, SKIP_PATHS, audit)
- apps/api/app/modules/rbac/router.py (T-5: caller-owns-permission guard, unknown perm 400)
- apps/api/app/modules/reference/router.py (T-2: superadmin guard currencies/units)
- apps/api/app/modules/sale/router.py (T-3: cross-tenant warehouse/product check + sale_date cast cleanup)
- apps/api/app/modules/finance/router.py (T-3: cashbox cross-tenant check create_movement + pay_sale)
- apps/api/app/modules/customer/router.py (T-4: import_customers chunked rollback)
- apps/api/app/modules/auth/router.py (T-4: register org-scoped role klon + T-6 phone normalize)
- apps/api/app/modules/customer_portal/auth.py (T-6: OTP try/except 422)
- apps/api/app/modules/customer_portal/router.py (T-6: SQL phone exact match)

Tests (yangi):
- apps/api/tests/test_security_sprint2.py (10 ta integration test)
- apps/api/tests/test_security_sprint2_unit.py (4 ta unit test)
- apps/api/tests/conftest.py (auth_token session-scope cache + teardown)

## Technical debt (productionga ketgan, kelajakda hal qilinadi)

1. **OTP integratsion test** SKIPPED (rate-limit 3/min testbed issue) - unit test qoplaydi, lekin integration coverage kerak.
2. **slowapi -> Redis migration** (in-memory hozir, multi-pod prod da rate-limit shared bolishi kerak).
3. **Alembic migration** - schema_patches ni alembic ga kochirish (CLAUDE.md tavsiyasi).
4. **Audit log row-level retention** - hozir hamma audit cheksiz yigiladi, ARCHIVE policy yoq.
5. **sale_date::date audit** - bu sprint sale modul da topdi va tuzatdi. Boshqa modullarda (finance.payment_date::date, customer.last_order_date::date) shu pattern qolgani ehtimoli bor - sprint lar boyicha audit kerak.

## Validation checklist (4-layer)

1. **Mechanical**: pytest 49 passed / 1 skipped / 0 failed; hook violations yoq.
2. **Agentic**: qa-reviewer 3 cycle independent (cycle 2/3/4), final 0 BLOCKER.
3. **Behavioral**: docker smoke + 4 ta manual API call (cross-tenant block, superadmin guard, normalize, RBAC) ishladi.
4. **Human-gate**: APPROVED (HUMAN-APPROVAL.md).

## CRITICAL/HIGH topilmalar yopilish maps

| ID | Sarlavha | Ticket | Status |
|---|---|---|---|
| CR-1 | PermissionMiddleware fail-OPEN | T-1 | CLOSED |
| CR-2 | sale create_sale cross-tenant warehouse/product | T-3 | CLOSED |
| CR-3 | finance create_movement + pay_sale cross-tenant cashbox | T-3 | CLOSED |
| CR-4 | reference currencies/units oddiy admin tomonidan ozgartirilishi | T-2 | CLOSED |
| HI-1 | import_customers bulk failure rollback yoq | T-4 | CLOSED |
| HI-2 | register da global role klonlash orniga org-scoped | T-4 | CLOSED |
| HI-3 | Audit log SENSITIVE_KEYS toliqsiz | T-1 (audit) | CLOSED (avval bor edi, kengaytirildi) |
| HI-4 | rate-limit endpoints toliqsiz | T-6 + T-1 | CLOSED |
| HI-5 | error messages tenant ID leak | T-3 cycle 3 | CLOSED |
| HI-6 | update_role_permissions privilege escalation | T-5 | CLOSED |
| HI-7 | OTP phone normalize qatiy emas | T-6 | CLOSED |
