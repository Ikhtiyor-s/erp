---
name: mast-anti-patterns
description: MAST taksonomiyasi — ko'p-agent jamoadagi 4 ta strukturaviy xato rejimi va ularni oldini olish. Use when designing orchestration, defining stop conditions, or debugging team failures.
---

# MAST anti-patterns (Multi-Agent Systems Taxonomy)

Tadqiqotchilar 1600+ haqiqiy ko'p-agent ishini o'rgandi. **Xatolar deyarli har doim strukturadan keladi, ahmoq modellardan emas.** Aqlliroq miya tuzatmaydi — **arxitektura** tuzatadi.

## 4 ta xato + yechim

### 1. Tugash yo'q (Cheksiz aylana)

**Belgisi**: ikki agent xabar/ishni cheksiz bir-biriga uzatadi. "Tekshir → tuzat → tekshir → tuzat → ..." aylanasi to'xtamaydi.

**Sabab**: aniq END sharti yo'q. Har agent "mukammal" qilishga harakat qiladi.

**Yechim**:
1. **Iteratsiya hisoblagichi**: max 3 marta qayta tuzatish. 4-uchda → odam eskalatsiya.
2. **Aniq END kriteriyalari**: "BLOCKER soni = 0 bo'lsa → tugadi" (MAJOR/MINOR keyingi PR).
3. **Byudjet limit**: token yoki vaqt chegarasi.

Implementatsiya (cto.md'da):
```
- BLOCKER 3 marta qaytarilsa → STOP, odamga "shu vazifa cho'kib qoldi, ko'rib bering" deb taqdim qiling
- Har retry'dan keyin diff'ni keyingi qaytarishda eslatib o'ting (regression chiqmasligi uchun)
```

### 2. Yo'qolgan uzatish (Tayoqchani tashlash)

**Belgisi**: keyingi agent oldingisi qo'lga olmagan narsani taxmin qiladi va xato qiladi.

**Sabab**: orchestrator agent'ga **xulosa** beradi ("backend tugadi, frontend ishlasin"), lekin to'liq **state**ni emas — DESIGN.md kontrakt, oxirgi 3 ta o'zgargan fayl, qa-reviewer'ning oldingi izohlari.

**Yechim**:
1. **State** ni har uzatishda to'liq uzating (qog'oz: SPEC + DESIGN + tugagan T-*.md fayllari + LESSONS qisqartmasi)
2. Builder'ga: "DESIGN.md va T-<id>.md ni o'qigandan keyin ishlay boshlang"
3. cto agent'ni har uzatishda **kontekst paketini** explicit qiladi:
```
> backend-dev: T-2-mxik-receipt-print.md ni o'qing. Avval bajarilgan: T-1 (column qo'shildi) — DESIGN.md ko'ring. Audit qoidalari: sirli emas. Tegishli kontrakt: receipt PDF endpoint allaqachon mavjud, faqat MXIK qatorini qo'shing.
```

### 3. Aniqlashtirish yo'q (So'ramaslik)

**Belgisi**: agent ishonchi yo'q, lekin **so'rash o'rniga taxmin qiladi**. Natija — noto'g'ri yo'nalishda yarim soat ish.

**Sabab**: agent kartasida "agar ishonching bo'lmasa, so'ra" qoidasi yo'q. Yoki agent "ahmoq ko'rinmaslik uchun" jim qiladi.

**Yechim**:
1. **Agent kartasida explicit**: "Agar T-*.md aniq emas yoki DESIGN.md kontrakt ziddiyatli bo'lsa — STOP va savol bering, taxmin qilmang"
2. **Confidence threshold**: agar mulohaza confidence < 70%, so'rash majburiy
3. cto agent uzatishda: "Savol bo'lsa, hozir bering. Boshlangandan keyin yarim soat sarflab xato qilmang."

### 4. Zaif tekshirish ("Menimcha yaxshi")

**Belgisi**: qa-reviewer "yaxshi ko'rinadi" deydi, lekin haqiqatan tekshirmaydi. Yoki yozuvchi o'zini tekshiradi (writer = reviewer, mantiqiy xato).

**Sabab**: Definition of Done aniq emas. Reviewer'ga **konkret checklist** yo'q.

**Yechim**:
1. **Definition of Done aniq** (CLAUDE.md'da):
   - OpenSpec propose/apply/archive
   - 4 qatlam tekshirish (mechanical + agentic + behavioral + human-gate)
   - Tajribali muhandis tasdiqlaydigan
2. **Reviewer ≠ writer** har doim (qa-reviewer alohida agent)
3. **Schema/test validation**: qa-reviewer kodni o'qish bilan kifoyalanmasin — testlar haqiqatan o'tdimi `pytest` chiqishini ko'rsin
4. Konkret rubric (qa-reviewer.md'da):
```
BLOCKER:
- Multi-tenant leak (org_id filter yo'q)
- Secret in code
- Broken test
- Syntax error

MAJOR:
- Missing index on new FK
- Missing aria-label
- Hardcoded grid-cols-N without sm: prefix
```

## Tashkilotchi mas'uliyatlari (cto)

cto agent **deterministik orchestrator** — emergent AI suhbati emas:

1. **Route**: keyingi agentni tanla (oddiy algoritm — qaysi T-*.md tayyor + dependency'lari hal qilingan)
2. **State**: har agentning o'qish/yozish doirasini belgilа (qaysi fayllar)
3. **Persist**: checkpoint qil — har qadamdan keyin tickets/SDLC.md'ni qayta o'qing
4. **Fail**: timeout, retry, fallback
5. **Gate**: muhim joyda odam uchun to'xta (pul, sirlar, deploy)

## "Faqat reviewer qo'shsam yetadi" — afsona

**YO'Q**. Reviewer **sehrli qalqon emas**. To'rt narsa kerak:
- Reviewer alohida agent
- Aniq stop conditions (iteratsiya/byudjet)
- To'liq state uzatish
- Strukturali tekshirish (schema/test/checklist), "intuitsiya" emas

## 5 ta validatsiya savoli (har sprintdan keyin)

cto sprint tugagach o'zidan so'raydi va javobini LESSONS.md'ga yozadi:

1. **Orchestrator deterministik kod edimi**, yoki "AIlar o'zi hal qiladi" suhbatga aylandimi?
2. **Umumiy state aniq belgilanganmi** va har agent o'z doirasini ko'rdimi?
3. **Tugash sharti aniqmi** (END marra + iteratsiya hisoblagichi)?
4. **Tekshiruvchi yozuvchidan boshqa agent edimi**?
5. **Har nazoratsiz agent ≤ 2 trifecta oyog'ini ushladimi**?

**Beshalasiga "ha" — sizda jamoa bor. Birortasiga "yo'q" — sizda jamoa kostyumi kiygan suhbat xonasi bor.**

## Narx haqiqati

- Ko'p-agent token sarfi **yagona chat × 15**.
- Unumdorlik o'zgaruvchanligining ~80% token sarfi bilan bog'liq.
- Ko'p-agent **faqat** ish mustaqil oqimlarga bo'linganda foydali.
- Chigallashgan ishni sequential, **yagona-agentda saqlang**.
- Konkurentlik chegarasi: **3-5 agent bir vaqtda**.

## Tool sprawl (asbob ko'pligi)

- 5 ta asbob bilan agent aniqligi ~95%
- 100 ta asbob bilan → < 30%
- Har agentni **~10-20 asbob** bilan chegaralang
- Bizning agentlar: pm/architect = 4 ta (Read/Write/Glob/Grep), cto = 4 ta (+Bash), dev = 6 ta, qa-reviewer = 3 ta
