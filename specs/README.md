# specs/ — Canonical spec library + sprint arxivi

OpenSpec aylanasining `archive` qismi.

## Tuzilma

```
specs/
├── README.md                              # bu fayl
├── templates/
│   ├── SPEC.template.md                   # PM uchun andoza
│   ├── DESIGN.template.md                 # Architect uchun andoza
│   └── REVIEW.template.md                 # QA uchun andoza
├── modules/                               # canonical per-module specs (sprint tugagach yangilanadi)
│   ├── sale.md
│   ├── finance.md
│   ├── warehouse.md
│   └── ...
└── archive/                               # sprint tugagach to'liq paketi
    ├── 2026-06-29-add-mxik-column/
    │   ├── SPEC.md
    │   ├── DESIGN.md
    │   ├── T-1-add-column.md
    │   ├── T-2-form-field.md
    │   ├── T-3-receipt-print.md
    │   ├── REVIEW.md                      # qa-reviewer yakuniy
    │   └── HUMAN-APPROVAL.md              # siz imzosingiz
    └── ...
```

## Aylana (har sprintda)

```
1. PROPOSE
   - PM: tickets/SPEC.md (templates/SPEC.template.md asosida)
   - PM: tickets/T-*.md (har vazifa)
   - Architect: tickets/DESIGN.md (templates/DESIGN.template.md asosida)

2. APPLY
   - CTO + devs + qa-reviewer kod yozadi va tekshiradi
   - tickets/ ichida hammasi ishlaydi

3. ARCHIVE
   - CTO: tickets/* → specs/archive/YYYY-MM-DD-<slug>/ ga ko'chiradi
   - QA: REVIEW.md ni yozadi
   - Siz: HUMAN-APPROVAL.md ni imzolaysiz (yoki PR approve)
   - Agar yangi modul edi yoki katta o'zgarish — specs/modules/<module>.md ham yangilanadi
   - LESSONS.md ga sprint xulosasi qo'shiladi
   - tickets/ bo'shaydi (keyingi sprint uchun)
```

## Canonical module spec (`specs/modules/<module>.md`)

Modulning "haqiqat manbasi". Sprintlardan delta'lar shu yerga birlashadi. PM yangi feature qo'shganda — bu faylni o'qib kontekstni oladi.

Format: oddiy markdown — endpointlar, schema, RBAC, business rules.

## Yangi modul (birinchi sprint)

PM birinchi marta o'sha modul'ga tegsa, sprint tugagach `specs/modules/<module>.md` yaratiladi (bu SPEC.md ning kanonik versiyasi).
