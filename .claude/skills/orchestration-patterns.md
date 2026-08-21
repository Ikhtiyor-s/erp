---
name: orchestration-patterns
description: 5 ta klassik orchestration pattern — sequential pipeline, router, parallel fan-out, orchestrator-worker, evaluator-optimizer. Use when designing how agents pass work, scheduling a sprint, or debugging coordination issues.
---

# Orchestration patterns (Aniq ERP cto playbook)

Tadqiqotchilar 1600+ ko'p-agent ishini o'rgandi. Real production tizimlari **yagona super-agentlar** emas, balki shu 5 ta patternning kombinatsiyasi. cto agent har sprintda bularning aralashmasini ishlatadi.

## Pattern 1 — Sequential Pipeline (estafeta)

**Ta'rif**: A → B → C, qat'iy tartib. Har agent o'z qismini tugatib, natijani keyingisiga uzatadi.

**Misol**: `pm → architect → cto → builders` (PROPOSE → DESIGN → DISPATCH).

```
[pm] tickets/SPEC.md
  ↓
[architect] tickets/DESIGN.md (kontrakt muzlatildi)
  ↓
[cto] schedule table → dispatch
```

**Asosiy xato**: keyingi agent oldingisidan kelgan **yashirin bog'liqlik**ni taxmin qiladi. Misol: architect "API endpoint avval mavjud" deb taxmin qiladi, lekin SPEC unda yangi endpoint ekanini aytadi.

**Yechim**: har **chegarada explicit schema/contract**. cto har dispatch'da to'liq kontekst paketi beradi:
- SPEC.md content (yoki link)
- DESIGN.md API kontrakt (full snippet, not summary)
- Tegishli T-*.md
- Prior ticket'lar natijasi (agar bo'lsa)

## Pattern 2 — Router (qabulxona xodimi)

**Ta'rif**: classifier kiruvchi vazifani **to'g'ri mutaxassisga** yo'naltiradi.

**Misol**: cto T-*.md'ni o'qib `owner` field'iga qarab `backend-dev` yoki `frontend-dev` yoki `architect`ga uzatadi.

**Asosiy xato**: noto'g'ri yo'naltirish. cto frontend ticket'ni backend-dev'ga uzatib qo'yadi.

**Yechim**:
1. Owner field har T-*.md'da **majburiy** (pm.md kartasida)
2. Ishonch chegarasi: agar 70% ishonch yo'q bo'lsa — STOP va so'rang
3. Zaxira yo'l: agar mos rol topilmasa — odam aralashishi

**Maslahat**: arzon model (router uchun haiku/sonnet kifoya — bu shunchaki saralash, opus shart emas).

## Pattern 3 — Parallel Fan-Out (kitobni bo'lish)

**Ta'rif**: N ta **mustaqil** vazifa bir vaqtda quriladi, oxirida birlashtiriladi.

**Misol**: T-1 (backend MXIK column) va T-2 (frontend MXIK form field) — DESIGN'da kontrakt muzlatilgan, ikkalasi **bir vaqtda** ishlay oladi.

```
              ┌→ [backend-dev: T-1] ┐
[cto dispatch]│                     │→ [cto merge]
              └→ [frontend-dev: T-2]┘
```

**Asosiy xato**: 2 ta agent **bitta faylga** parallel yozadi → konflict yoki bir-birini overwrite.

**Yechim**:
1. **Isolation by file**: T-1 faqat `apps/api/` ga tegadi, T-2 faqat `apps/web/` ga
2. Shared fayl (masalan, `menu.config.ts`) — sequential qiling, parallel emas
3. **API contract muzlatish** (DESIGN.md) — backend va frontend bir-biriga to'qnashmaydi

**Konkurentlik chegarasi**: **3-5 agent**. Ko'p bo'lsa, koordinatsiya overhead'i parallel yutuqdan oshib ketadi.

## Pattern 4 — Orchestrator-Worker (bosh oshpaz)

**Ta'rif**: bitta agent (orkestrator) **ish-vaqtida** vazifalarni ajratadi, ishchilarni tayinlaydi, natijalarni yig'adi.

**Misol**: cto = bosh oshpaz. SPEC + tickets keldi → cto **shu yerda hal qiladi**:
- Qaysi parallel, qaysi sequential
- Kim qaysi vazifa egasi
- Qachon birlashtirish

```
[cto] ── read SPEC + tickets ──→ ┐
                                 │
                ┌────────────────┤
                ↓                ↓
        [backend-dev]    [frontend-dev]
                ↓                ↓
                └────────┬───────┘
                         ↓
              [cto: integrate + qa cycle]
```

**Bu sprint suyagi**. Boshqa patternlar (sequential, parallel, router) shu ichida ishlatiladi.

**Asosiy xato**: ish-vaqti xatolari **to'planadi**. Bir kichik xato → keyingi qadamga uzatiladi → katta muammoga aylanadi.

**Yechim**:
1. **Typed handoff**: har dispatch'da kontekst paketi aniq (SPEC + DESIGN + ticket + prior results)
2. **Integration bosqichi**: har builder tugagandan keyin avtomatik qa-reviewer
3. **Checkpoint**: cto har qadamdan keyin SDLC.md ni qayta o'qiydi

## Pattern 5 — Evaluator-Optimizer (tahrirlash aylanasi)

**Ta'rif**: yarat → tekshir → tuzat → qayta tekshir → toza bo'lguncha.

**Misol**: `backend-dev T-1 → qa-reviewer → BLOCKER chiqdi → backend-dev tuzatadi → qa-reviewer qayta`.

```
[builder] ── kod ──→ [qa-reviewer]
   ↑                       │
   │ BLOCKER list          │ 0 BLOCKER?
   └───────────────────────┘
                           ↓ ha
                       [ APPROVED ]
```

**Asosiy xato**: **cheksiz aylana** — har tuzatish yangi MAJOR yaratadi, qa qayta qaytaradi.

**Yechim** (cto.md'da):
1. **Iteratsiya hisoblagichi**: max 3 cycle per ticket
2. **3-uchda → human eskalatsiya**: "T-X cho'kib qoldi, ko'rib bering"
3. **Aniq END kriteriya**: "BLOCKER = 0 → tugadi" (MAJOR/MINOR keyingi PR)
4. **Diff'ni eslatib o'tish**: 2-builder qaytarishida "siz oldin nima qildingiz" eslatma — regression chiqmasligi uchun

## Sprintni qanday quriladi (har 5 ta pattern birga ishlaydi)

```
PROPOSE phase
└─ SEQUENTIAL: pm → architect

APPLY phase (cto orchestratsiya)
├─ ROUTER: cto T-*.md owner'ni o'qib to'g'ri dev'ga
├─ PARALLEL: mustaqil T-*.md lar bir vaqtda
│  └─ EVALUATOR-OPTIMIZER: har dev → qa-reviewer → cycle
└─ SEQUENTIAL: bog'liq T-*.md lar prior tugagandan keyin

ARCHIVE phase
└─ SEQUENTIAL: cto → human approve → cto archives
```

## Anti-pattern: "Hammaga bitta xona berib qo'yamiz"

❌ "AIlar o'zaro gaplashib hal qilsin" — bu **emergent suhbat** ishlamaydi.

✅ cto **deterministik kod** (orkestrator). Patternlar — siz **avval** loyihalaysiz, agent **kuzatib boradi**.

## Pattern tanlash uchun qaror tablitsasi

| Holatga qarab | Pattern |
|---|---|
| Tartib qat'iy (A → B → C) | Sequential |
| Vazifa turi noma'lum, classify kerak | Router |
| Mustaqil ishlar, fayllar to'qnashmaydi | Parallel fan-out |
| Bosh ishlovchi ish-vaqtida tarqatadi | Orchestrator-worker (default) |
| Sifat aylanasi kerak (yarat-tekshir-tuzat) | Evaluator-optimizer |

## Narx haqiqati

- **Yagona-agent chat**: 1× baseline
- **Yagona agent + asboblar (agentic)**: ~4× baseline
- **Ko'p-agent (orchestrator + workers)**: ~15× baseline
- Unumdorlik o'zgaruvchanligining ~80% token sarfi bilan bog'liq

**Ko'p-agent faqat** ish mustaqil oqimlarga bo'linganda foydali. Chigallashgan ish — sequential, yagona-agent. cto bu qarorni har sprint boshida qiladi.
