# REVIEW — 2026-06-29-mxik

**Sprint**: P0-2 — MXIK kod field (products jadvaliga MXIK identifikator)
**QA reviewer**: qa-reviewer agent (READ-ONLY, Read/Grep/Glob only)
**Total cycles**: 3
**Final verdict**: APPROVED (0 BLOCKER / 0 MAJOR / 0 MINOR)

## Tickets in scope

| Ticket | Owner | Final status |
|---|---|---|
| T-1-mxik-backend-column | backend-dev | Merged (1 cycle) |
| T-2-mxik-frontend-ui | frontend-dev | Merged (3 cycles) |
| T-3-mxik-backend-tests | backend-dev | Merged (1 cycle) — 9/9 pytest PASS |

## QA cycle history

### Cycle 1 — 3 BLOCKER

T-2 (frontend) ga qaratilgan:

1. **BLOCKER**: `app/(dashboard)/warehouse/products/page.tsx` modal'da MXIK field uchun `Field` komponenti emas, oddiy `<input>` ishlatilgan — CLAUDE.md "frontend konvensiyalari" buzilgan.
2. **BLOCKER**: Modal grid `grid-cols-2` `sm:` prefix'siz ishlatilgan — `grid-cols-1 sm:grid-cols-2` shart edi. Hardcoded multi-column responsive prefix'siz CLAUDE.md anti-pattern.
3. **BLOCKER**: i18n string'lar `messages/uz.json` ga qo'shilgan, lekin `ru.json`, `en.json`, `uz-cyrl.json` ga qo'shilmagan — 4 ta locale fayl bo'lishi shart edi (CLAUDE.md 4 til: uz/ru/en/uz-cyrl).

frontend-dev ga qaytarilgan, "shu 3 ta narsani tuzating, boshqasiga tegmang" deb.

### Cycle 2 — 1 BLOCKER + 1 false positive

frontend-dev cycle 1 BLOCKER'larini tuzatdi. Lekin yangi cycle topdi:

1. **BLOCKER**: `messages/uz-cyrl.json` ga MXIK string lotin yozuvida qo'shilgan ("MXIK kod"), kirill emas ("МХИК код"). uz-cyrl faqat kirill bo'lishi kerak.
2. **DRIFT shubhasi (false positive)**: `lib/locale-provider.tsx` da faqat 3 ta til ko'rinadi (uz/ru/en), uz-cyrl yo'q deyilgan — frontend-dev DRIFT qildimi? Tekshirilgandan keyin ma'lum bo'ldiki, locale-provider avvaldan 3 til edi, frontend-dev tegmagan. SPEC.md "4 ta i18n faylga string qo'shing" deydi, locale-provider ni o'zgartirishni so'ramaydi. False positive sifatida bekor qilindi.

frontend-dev ga qaytarilgan: faqat uz-cyrl.json kirill transliteratsiyasini tuzating.

### Cycle 3 — APPROVED

frontend-dev `messages/uz-cyrl.json` ni kirill yozuviga to'g'rilagan:
- "МХИК код" / "МХИК кодини киритинг"

qa-reviewer 0 BLOCKER, 0 MAJOR, 0 MINOR. APPROVED.

## Behavioral check (cto integration)

- `docker compose restart api` muvaffaqiyatli
- `docker exec erp-api pytest apps/api/tests/test_warehouse_products_mxik.py -v` → 9 PASS / 0 FAIL
- Manual smoke: `POST /warehouse/products` body'ga `mxik: "01234567"` qabul qiladi, `GET` qaytaradi
- DB schema_patches idempotent: `products.mxik VARCHAR(17) NULL` qo'shilgan, qayta restart'da xatosiz

## Technical debt (productionga ketgan)

Sprint scope'iga kirmagan, kelajakda hal qilish kerak:

1. **uz-cyrl to'liq transliteratsiya**: hozir sprint faqat MXIK string'larini kirill qildi. Lekin loyihada boshqa joylarda uz-cyrl.json fayllar hali ham aralash (lotin + kirill) yoki bo'sh. Alohida sprint kerak — full uz↔uz-cyrl transliteratsiya tooling (sub-agent yoki script) yaratish.
2. **Modal grid responsive pattern audit**: bu sprint mxik modal'ida `grid-cols-1 sm:grid-cols-2` ishlatildi. Lekin loyihada boshqa modal'larda (`grid-cols-2`, `grid-cols-3` prefix'siz) hali mavjud bo'lishi mumkin. frontend-ux-reviewer audit kerak — barcha modal'larni topib, responsive prefix qo'shish.
3. **locale-provider 4-til kengaytma**: CLAUDE.md 4 til (uz/ru/en/uz-cyrl) deydi, lekin `lib/locale-provider.tsx` faqat 3 til (uz/ru/en). uz-cyrl message fayllari mavjud lekin provider'da locale switcher yo'q. Bu CLAUDE.md va kod orasidagi nomuvofiqlik.
4. **MXIK reference jadval (P0-2 follow-up)**: hozir products.mxik faqat VARCHAR field. Kelajakda O'zbekiston Davlat Statistika Qo'mitasi MXIK katalogi (reference jadval) bilan validate qilish — alohida sprint.

## Files changed (sprint snapshot)

Backend:
- `apps/api/app/modules/warehouse/router.py` (POST/PUT products mxik field)
- `apps/api/app/modules/warehouse/schemas.py` (ProductIn/ProductOut mxik: Optional[str])
- `apps/api/app/db/schema_patches.py` (PATCHES list'ga products.mxik DDL)
- `apps/api/tests/test_warehouse_products_mxik.py` (NEW — 9 ta test)

Frontend:
- `apps/web/app/(dashboard)/warehouse/products/page.tsx` (modal + table mxik column)
- `apps/web/i18n/messages/uz.json`
- `apps/web/i18n/messages/ru.json`
- `apps/web/i18n/messages/en.json`
- `apps/web/i18n/messages/uz-cyrl.json`

## Validation checklist (4-layer)

1. Mechanical: pytest 9/9 PASS, no hook violations during writes
2. Agentic: qa-reviewer 3 cycle, final 0 BLOCKER
3. Behavioral: docker smoke + manual API call ishladi
4. Human-gate: kutilmoqda (HUMAN-APPROVAL.md)
