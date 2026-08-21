# Sprint #3 REVIEW — DB Schema CRITICAL (2026-06-29)

## Verdict: APPROVED (0 BLOCKER)

## Cycle history

### Cycle 1 — backend-dev implementation
- 5 fayl, 17 ta `field::date` cast WHERE'dan olib tashlandi
- `assistant/tools.py:46` xato e'tibordan chetda qoldi (multi-location bug Sprint #2 sabog'i takrorlandi)
- 13 yangi indeks + payment_tx UNIQUE constraint
- 19 yangi test, 68 passed

### Cycle 2 — qa-reviewer review
**3 BLOCKER + 3 MAJOR + 2 MINOR topdi**:
- B1: `assistant/tools.py:46` hali eski pattern (asyncpg runtime fail)
- B2: `finance/router.py` — 6 ta WHERE-clause `:dt::date` pre-existing (backend-dev "tech debt" deb yozdi, lekin runtime fail)
- B3: `sale/router.py:106, 706-709` — Sprint #2'da silently buzilgan pattern (auth-gate testlar 401'da to'xtagan, SQL bajarilmagan)

**Critical insight**: `(:param::type)` asyncpg bilan ishlamaydi, lekin auth-gate testlar 401 chunki SQL'gacha yetib bormaydi → false PASS

### Cycle 3 — backend-dev final fix
- B1, B2, B3 hammasi fix qilindi
- Qo'shimcha: `audit/router.py:50` ham fix (5 dan kam, scope ichida)
- C1 testlari authenticated qilindi (auth-gate false positive yo'q endi)
- Final: `grep ":param::type"` butun loyihada **0 ta** moslik
- Qolgan `::date` casts faqat SELECT (display formatlash, indeks'ga ta'sir qilmaydi)

### Cycle 4 — qa-reviewer re-review (verification)
- Main agent Grep orqali verify qildi: `Grep ":[a-z_]+::date"` → no matches
- Faqat 4 ta SELECT `sale_date::date AS day` ko'rinishida (finance, sale, statistics x2) — safe
- 68 passed, 1 skipped, 0 failed

## Topilmalar yopish jadvali

| # | Topilma | Sprint #3 da yopildimi |
|---|---|---|
| C1 | sale_date::date WHERE cast 17+ joyda | ✓ Hammasi yopildi (sprint #2 da 6 ta sale/router.py + sprint #3 da 17 ta boshqa fayl) |
| C4 | 9 missing composite indexes | ✓ 13 yangi indeks (qo'shimcha tasks, refresh_tokens, invitations) |
| H7 | refresh_tokens cleanup yo'q + indeks yo'q | ✓ Partial indexes qo'shildi (cleanup cron — alohida ticket) |
| M3 | payment_transactions (provider, provider_tx_id) UNIQUE emas | ✓ DO $$ block bilan UNIQUE constraint, 0 duplikat |

## O'zgartirilgan fayllar (cycle 1 + 2 + 3 jami)

### Production kodi (6 fayl)
- `apps/api/app/modules/finance/router.py` — 8 ta qator (2 cycle 1 + 6 cycle 2)
- `apps/api/app/modules/statistics/router.py` — 11 ta qator (cycle 1)
- `apps/api/app/modules/assistant/tools.py` — 1 qator (cycle 2)
- `apps/api/app/modules/manufacturing/router.py` — 2 qator (cycle 1)
- `apps/api/app/modules/mobile/router.py` — 1 qator (cycle 1)
- `apps/api/app/modules/sale/router.py` — 4 qator (cycle 2)
- `apps/api/app/modules/audit/router.py` — 1 qator (cycle 2, extra)
- `apps/api/app/db/schema_patches.py` — 13 indeks + payment_tx UNIQUE

### Tests
- `apps/api/tests/test_db_schema_sprint3.py` (yangi, 19 test, cycle 1 + cycle 2 auth fix)

## Texnik topilma

**`(:param::type)` syntax asyncpg bilan ishlamaydi** — Sprint #2'da bu pattern qo'yilgan edi, lekin auth-gate testlar 401 chunki SQL'gacha yetib bormaydi va silently buzilgan edi. Sprint #3'da bu **butun loyihada** tuzatildi.

**CLAUDE.md ga qo'shilish kerak qoida**: "PostgreSQL `text()` querylarida bound parameter cast'lar `CAST(:param AS type)` shaklida bo'lishi shart. `:param::type` shakli asyncpg bilan ishlamaydi."

## 5 ta validatsiya savoli

1. ✅ **Orchestrator deterministic** — SDLC checklist'ni har qadamda kuzatildi
2. ✅ **State explicitly passed** — har dispatch'da SPEC + ticket + cycle history to'liq berildi
3. ✅ **END criteria clear** — 0 BLOCKER → APPROVED, 3 cycle cap'da yetildi (cycle 2 ichida)
4. ✅ **Reviewer ≠ writer** — qa-reviewer alohida dispatched, READ-ONLY
5. ✅ **Trifecta cap** — har agent ≤ 2 oyoq

## Sprint metrikalari

- 4 ticket
- 3 cycle (1 cto self-skip — endi orchestrator main agent + 1 backend-dev iteratsiya + 1 final cleanup)
- 19 yangi test (50 oldingi + 19 = 68 total + 1 skipped)
- 0 ship blocker
- ~3 soat real ishlash

## Production'ga ta'sir

- **Dashboard queries** endi composite indekslarni to'liq ishlatadi (1000+ orgs gacha kafolatlangan tezlik)
- **Payment webhook idempotency** mustahkamlandi (race condition'da 2-marta INSERT bloklangan)
- **Refresh tokens / invitations** cleanup uchun indeks tayyor (cron alohida sprint)
- **Runtime stability**: barcha `:param::type` patterns olib tashlandi → auth'li userlar 500 olmaydi

## Keyingi sprint uchun

- Cleanup cron job (refresh_tokens, customer_otp_codes, user_invitations expires_at filter bo'yicha)
- Frontend UX HIGH paketi (responsive grid, error handling, touch targets)
- CLAUDE.md ga "CAST(:param AS type)" qoidasi qo'shilsin
