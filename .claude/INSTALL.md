# AI Scrum Team — Install Guide

> Universal AI agent jamoasi. Har loyihaga joylashtirib ishlatish mumkin.

## Nima bu

7 ta build-team agenti + 5 ta audit agenti + 9 ta bilim kartasi + 3 ta xavfsizlik hook + sprint scaffold. Loyihangiz tilini va framework'ini avtomatik aniqlab moslashadi.

## Loyihaga qanday joylashtiriladi

### Variant A — Yangi loyiha (bootstrap)

```bash
# 1. Bu papka ichidagilarni yangi loyihaga ko'chiring:
cp -r .claude/                 /path/to/new-project/
cp    CLAUDE.template.md       /path/to/new-project/
cp -r tickets/                 /path/to/new-project/
cp -r specs/                   /path/to/new-project/
echo "# LESSONS" >             /path/to/new-project/LESSONS.md

# 2. Yangi loyihaga o'ting va Claude Code'ni oching
cd /path/to/new-project
# VS Code yoki terminalda Claude Code

# 3. Birinchi xabaringizda:
"project-bootstrap'ni chaqir: bu loyihani sozla"

# 4. Agent loyihangizni skan qilib, 5-7 ta savol berib, CLAUDE.md ni yozadi
```

### Variant B — Mavjud loyiha (manual)

```bash
# 1. .claude/, tickets/, specs/ ni ko'chiring (yuqoridek)
# 2. CLAUDE.template.md ni CLAUDE.md qilib nusxalang
cp CLAUDE.template.md /path/to/project/CLAUDE.md

# 3. CLAUDE.md ni qo'lda to'ldiring:
#    - Stack ma'lumotlari
#    - Loyiha tuzilishi
#    - Data isolation modeli
#    - Authorization modeli
#    - Build / test buyruqlari

# 4. Hooks'ni executable qiling
chmod +x .claude/hooks/*.sh

# 5. Yangi Claude Code sessiyasi — agentlar va skills avto-yuklanadi
```

### Variant C — git submodule sifatida (ko'p loyihalarda bir xil versiya)

```bash
# Repo'ni yarating (this team as a standalone repo)
# Loyihalarga submodule sifatida joylang:
cd /path/to/project
git submodule add https://github.com/your-org/ai-scrum-team .claude-team
ln -s .claude-team/.claude .claude
ln -s .claude-team/CLAUDE.template.md CLAUDE.template.md
ln -s .claude-team/tickets tickets-template
ln -s .claude-team/specs   specs-template
cp -r .claude-team/tickets tickets   # writable copy for this project
cp -r .claude-team/specs   specs
```

## Tuzilma (nima qaerda)

```
.claude/
├── INSTALL.md                  ← bu fayl
├── settings.json               ← permissions + hook ulanishi
├── agents/
│   ├── BUILD TEAM (7 ta — har loyihada bir xil, CLAUDE.md ni o'qib moslashadi)
│   │   ├── project-bootstrap.md  ← YANGI loyihada birinchi marta chaqiriladi
│   │   ├── pm.md                 ← SPEC.md + ticket fayllari yozadi
│   │   ├── architect.md          ← DESIGN.md + API kontrakt
│   │   ├── cto.md                ← orkestrator + ARCHIVE
│   │   ├── backend-dev.md        ← server kod (har til/framework'ga moslashadi)
│   │   ├── frontend-dev.md       ← UI kod (har framework'ga moslashadi)
│   │   └── qa-reviewer.md        ← READ-ONLY review (drift + xavfsizlik)
│   └── AUDIT TEAM (5 ta — chuqur tahlil uchun on-demand)
│       ├── erp-market-analyst.md  ← ⚠️ bu Aniq ERP'ga moslashtirilgan — boshqa loyihada o'zgartiring yoki o'chiring
│       ├── backend-auditor.md     ← chuqur backend audit
│       ├── frontend-ux-reviewer.md
│       ├── db-schema-reviewer.md
│       └── test-engineer.md
├── skills/                     (9 ta universal bilim kartasi)
│   ├── data-isolation-patterns.md       ← multi-tenant/per-user
│   ├── authorization-patterns.md        ← RBAC/ABAC/ReBAC
│   ├── responsive-ui.md                 ← har framework
│   ├── security-trifecta.md             ← universal
│   ├── openspec-format.md               ← universal
│   ├── orchestration-patterns.md        ← universal
│   ├── mast-anti-patterns.md            ← universal
│   ├── db-migration-safety.md           ← Postgres/MySQL principle
│   └── api-integration-reliability.md   ← universal
└── hooks/
    ├── guard.sh                ← PreToolUse Bash blok (11 ta pattern)
    ├── quality-check.sh        ← PostToolUse syntax check (10+ til)
    └── wrapup.sh               ← Stop hook → LESSONS.md ga timestamp

CLAUDE.template.md              ← har loyiha o'zinikini to'ldiradi
CLAUDE.md                       ← loyiha-xos kontekst (template'dan generatsiya qilinadi)
LESSONS.md                      ← jamoaning xotira jurnali

tickets/                        ← joriy sprint workspace
├── README.md
└── SDLC.md                     ← sprint checklist (cto har qadamdan keyin o'qiydi)

specs/                          ← kanonik spec kutubxonasi
├── README.md
├── templates/                  ← SPEC, DESIGN, REVIEW andozalar
├── modules/                    ← per-modul kanonik specs (sprint tugagach yangilanadi)
└── archive/                    ← sprint paketlari
```

## Tezkor boshlash (yangi loyihada)

### 1. Joylashtirish
Yuqoridagi Variant A yoki B.

### 2. Bootstrap (yangi loyihada birinchi sessiya)
```
Sizdan: "project-bootstrap'ni chaqir"
```

Agent:
- Loyiha root'ini skan qiladi (package.json / requirements.txt / go.mod / ...)
- Stack'ni aniqlaydi (language / framework / DB / frontend)
- Sizga 5-7 ta savol beradi (mahsulot maqsadi, mijoz, regulations)
- CLAUDE.md ni yozadi
- LESSONS.md, tickets/, specs/ scaffolding'ni yaratadi

### 3. Birinchi sprint
```
Sizdan: "pm'ni chaqir: <feature so'rovi>"
```

PM:
- CLAUDE.md ni o'qib loyihangizni tushunadi
- SPEC.md (RFC 2119 + Given/When/Then + QILMAYMIZ) yozadi
- T-1, T-2, T-3 vazifa fayllarini yaratadi

```
Sizdan: "architect'ni chaqir"  (agar full-stack bo'lsa)
```

Architect → DESIGN.md (API kontrakt muzlatadi).

```
Sizdan: "cto'ni chaqir"
```

CTO:
- Jadval tuzadi (parallel / sequential)
- Builder'larni ishga tushiradi
- qa-reviewer cycle'ni boshqaradi
- Sizga taqdim qiladi
- Sizdan "approved" eshitsa — ARCHIVE qiladi

## Tilga moslashish

Agentlar avtomatik moslashadi. Misol uchun:

### Python + FastAPI loyiha
- backend-dev: pytest + SQLAlchemy + Pydantic ishlatadi
- quality-check.sh: `.py` fayllar uchun AST parse
- db-migration-safety: alembic / schema_patches.py

### Node + Next.js loyiha
- backend-dev: NestJS yoki Express + Prisma
- frontend-dev: React + Tailwind
- quality-check.sh: brace balance check

### Go + Gin loyiha
- backend-dev: go test + sqlx
- quality-check.sh: gofmt -l

### Yangi loyiha → CLAUDE.md'da declare qiling, agent moslashadi.

## Universal xavfsizlik (har loyihada bir xil)

`settings.json`'da `deny` list:
- `.env` faylga shell orqali kirish
- `WebFetch` (Claude tool)
- `Bash(curl:*)`, `Bash(wget:*)`, `Bash(nc:*)` — egress
- `Bash(git push --force *)`
- `Bash(docker compose down --volumes*)`, `Bash(docker volume rm*)`

`guard.sh` qo'shimcha bloklar:
- `git commit --no-verify`
- `--no-gpg-sign`
- Loopback covert channel
- base64+pipe obfuscation
- `rm -rf` xavfli yo'lda
- Sirli faylga shell redirect

`ask` list (oddiy talabga ruxsat so'raydi):
- `git push`, `git commit`
- `.claude/` ichidagi fayllarga edit
- Schema baseline fayl edit
- `npm install`, `pip install` (yangi dependency)

## Audit team (ixtiyoriy, chuqur tahlil)

Build team default. Audit team **mahsus** chaqiriladi:
- "loyihani audit qil" → `backend-auditor`, `frontend-ux-reviewer`, `db-schema-reviewer` parallel
- "bozor tahlil" → `erp-market-analyst` (Aniq ERP'ga moslashtirilgan — boshqa loyihada o'chirish kerak)
- "testlar yoz" → `test-engineer`

## Texnik talablar

- Claude Code (CLI yoki VS Code extension) v1.x+
- Bash (Linux/macOS yoki Git Bash on Windows) — hook ishlashi uchun
- Python 3 (quality-check syntax tekshiruvi uchun)
- Loyiha til'iga moslab: pytest / npm / go / cargo / etc. (project's test commands)

## Eslatma

- Agent kartalarini **o'zgartirmang** — universal qilingan
- Loyiha-xos qoidalar **faqat CLAUDE.md'da** yozilsin
- Hookalar root'da ishlamasligi mumkin (Windows) — Git Bash bilan ishlaydi

## Yordam

- Skill yetishmaganmi? `.claude/skills/` ga yangi `.md` qo'shing — agent uni avto-yuklaydi
- Permission ko'p ask qilyaptimi? `.claude/settings.json` `ask` list'ini sozlang
- Hook xato berayaptimi? `bash -n .claude/hooks/<file>.sh` bilan tekshiring

Birinchi loyihangizga muvaffaqiyat tilaymiz.
