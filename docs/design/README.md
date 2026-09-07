# Design System — Duralux-inspired

Aniq ERP dizayn tili **Duralux React Dashboard** template'idan ilhomlangan (professional B2B SaaS look-and-feel).

## Source

- **Template**: Duralux React Dashboard
- **Live demo**: https://duralux-react-dashboard.vercel.app/
- **Base framework**: Bootstrap 5 (Duralux) → **Aniq ERP: Tailwind 3** (adaptatsiya)

## Reference fayllar

`docs/design/duralux/pages/` — 20 ta HTML sahifa (Vite build snapshot):

- `dashboards__analytics.html` — main dashboard, chart cards, statistika widgets
- `applications__tasks.html` — task board (Kanban-like)
- `applications__calendar.html` — full-page calendar
- `applications__email.html` — email inbox layout
- `applications__notes.html` — notes app
- `customers__list.html` — CRM customer list
- `customers__view.html` — customer detail (2-column, profile + activity)
- `customers__create.html` — customer form
- `leads__list.html` — leads pipeline
- `leads__view.html` — lead detail
- `projects__list.html`, `projects__view.html` — projects module
- `payment__list.html`, `payment__view.html`, `payment__create.html` — invoicing
- `authentication__login__cover.html` — auth with side illustration
- `authentication__login__creative.html` — auth with creative layout
- `authentication__login__minimal.html` — minimal auth (current Aniq'ga o'xshash)

`docs/design/duralux/assets/index-D1a-T4mr_4527e0.css` — Duralux minified CSS (Bootstrap 5 + custom Duralux styles). Rang, radius, spacing token'lari uchun manba.

`docs/design/duralux/pages/_meta.json` — 165 sahifa URL ro'yxati + assets manifest.

## Design tokens (Aniq ERP'da qabul qilingan)

| Token | Duralux | Aniq ERP (`tailwind.config.ts`) |
|---|---|---|
| Primary (brand-500) | `#3454d1` indigo | `#3454d1` |
| Success (500) | `#17c666` | `#17c666` |
| Info (500) | `#3dc7be` | `#3dc7be` |
| Warning (500) | `#ffa21d` | `#ffa21d` |
| Danger (500) | `#ea4d4d` | `#ea4d4d` |
| Body text (ink-500) | `#64748b` (slate) | slate palette (500 `#64748b`) |
| Body BG (light) | `#f0f2f8` | `#f0f2f8` (`globals.css`) |
| Border radius default | 4px | 4px (`borderRadius.md`) |
| Border radius card | 16px | 16px (`borderRadius.xl`) |
| Font | system-ui stack | Inter + system-ui fallback |

## Adaptatsiya qoidalari

Duralux → Aniq ERP komponent yaratganda:

1. **Bootstrap → Tailwind class mapping**:
   - `.card` → `bg-white dark:bg-ink-900 border border-ink-200 rounded-xl`
   - `.btn-primary` → `bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-md`
   - `.btn-outline-secondary` → `border border-ink-300 text-ink-700 hover:bg-ink-100 px-4 py-2 rounded-md`
   - `.badge-success` → `bg-success-50 text-success-700 px-2 py-0.5 rounded text-xs`
   - `.table` → mavjud `<DataTable>` komponent'i (`components/ui/data-table.tsx`)

2. **Rang palitrasi**:
   - Primary action (Save, Submit, Confirm) → `brand-500`/`brand-600`
   - Secondary (Cancel, Back) → `ink-200` outline yoki `text-ink-600`
   - Success feedback → `success-500` / `success-50` bg
   - Error / danger → `danger-500`
   - Warning → `warn-500`
   - Info / neutral badge → `info-500`

3. **Radius**:
   - Small chip/badge: `rounded` (4px) yoki `rounded-sm` (2px)
   - Button/input: `rounded-md` (4px)
   - Card container: `rounded-xl` (16px) — Duralux katta cards uchun 16px
   - Avatar/circle: `rounded-full`

4. **Shadow**:
   - Card: `shadow-sm` (yumshoq, deyarli ko'rinmas)
   - Modal/dropdown: `shadow-lg`
   - Duralux umumiy stil — flat + minor shadow

5. **Responsive**:
   - Har yangi sahifa: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-N` pattern
   - Mobile-first: 375px minimum
   - Table pattern: `<div className="hidden md:block">` (desktop table) + `<ul className="md:hidden">` (mobile card list)

## Reference qanday ishlatiladi

Kelasi sprint'larda yangi sahifa yaratganda:
1. Duralux'ning mos sahifasini live demo'da ochib ko'ring
2. Aniq'ga qanday moslashishi kerakligini reja qiling
3. Tailwind komponentlar bilan qayta yozing (Bootstrap class'larni HTML'dan **ko'chirmang** — Aniq Tailwind'da qoladi)
4. Design token'larni ushbu README'dan oling (rang, radius, shadow)

## Umumiy tavsiyalar

- **Aniq'ning kuchli tomonlari saqlansin**: multi-tenant, RBAC, BOM, pick workflow, mobile PWA
- **Duralux'dan olinadi**: visual polish, chart stillar, form layoutlar, badge/status ko'rinishi, auth page variantlari
- **Duralux'dan olinmaydi**: Bootstrap class'lar, jQuery kod, non-React patternlar

## Rebrand tarixi

- **2026-09-05** (Sprint 5 dan keyin): brand emerald → indigo, ink zinc → slate, radius 6-8px → 4px, body BG oq → `#f0f2f8`. Barcha mavjud sahifalar avtomatik yangi look-and-feel'ga o'tdi (Tailwind config o'zgarishi orqali).
