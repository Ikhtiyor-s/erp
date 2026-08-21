---
name: responsive-ui
description: Responsive design + accessibility conventions applicable to any modern frontend framework. Mobile-first, viewport breakpoints, mobile table → card pattern, fluid typography, focus management, ARIA. Use when building any UI page or component.
---

# Responsive UI conventions

> Universal skill. Framework-specific component names live in `CLAUDE.md`. This skill describes the PATTERNS.

## 3-viewport rule (universal)

Every page must work at minimum:

| Width | Device class | Common CSS approach |
|---|---|---|
| 375–430px | Mobile phone | default (mobile-first), no breakpoint prefix |
| 640–1024px | Tablet | `sm:` / `md:` (Tailwind), `@media (min-width: 640px)` (vanilla) |
| 1280px+ | Desktop | `lg:` / `xl:` (Tailwind), `@media (min-width: 1280px)` |

If a page breaks at any of these — BLOCKER.

## Mobile-first principle

Default styles target mobile. Add complexity progressively via breakpoint prefixes:

```html
<!-- ❌ BAD — desktop-first, breaks on mobile -->
<div class="grid grid-cols-4 gap-3">

<!-- ✅ GOOD — mobile stacks, then expands -->
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
```

## Tables on mobile (the card pattern)

Tables don't fit on phones. Two options:

**Option A — Horizontal scroll** (data-heavy, rare on mobile):
```html
<div class="overflow-x-auto">
  <table class="w-full">...</table>
</div>
```

**Option B — Card layout** (default for editable lists):
```html
<!-- Desktop -->
<div class="hidden md:block">
  <table class="w-full">...</table>
</div>

<!-- Mobile -->
<ul class="md:hidden divide-y">
  <li class="p-3 space-y-2">
    <div class="flex items-start justify-between">
      <div class="min-w-0">
        <div class="font-medium truncate">Primary</div>
        <div class="text-xs text-gray-500 truncate">Secondary</div>
      </div>
      <span class="badge">Status</span>
    </div>
    <div class="flex gap-2">
      <!-- actions row -->
    </div>
  </li>
</ul>
```

## Fluid typography (Tailwind + CSS clamp)

```ts
// Tailwind config
fontSize: {
  xs:   ["clamp(0.6875rem, 0.65rem + 0.2vw,  0.75rem)",   { lineHeight: "1.1rem" }],
  sm:   ["clamp(0.75rem,   0.7rem + 0.25vw,  0.8125rem)", { lineHeight: "1.25rem" }],
  base: ["clamp(0.8125rem, 0.75rem + 0.3vw,  0.9375rem)", { lineHeight: "1.375rem" }],
  lg:   ["clamp(0.9375rem, 0.85rem + 0.4vw,  1.0625rem)", { lineHeight: "1.5rem" }],
  xl:   ["clamp(1.0625rem, 0.95rem + 0.5vw,  1.25rem)",   { lineHeight: "1.75rem" }],
}
```

Use `clamp(min, vw-based, max)` so text scales with viewport without breakpoints.

## Loading / Empty / Error states (all 3 mandatory)

```pseudocode
{loading && <Skeleton />}
{!loading && data.length === 0 && (
  <Empty>
    {hasActiveFilters ? "No results for these filters" : "Nothing here yet"}
    {hasActiveFilters && <button onClick={resetFilters}>Clear filters</button>}
  </Empty>
)}
{!loading && data.length > 0 && /* render */}
```

Differentiate "real empty" from "filter no results" — UX must show why.

## API call pattern (universal)

```typescript
import { httpClient } from "@/lib/http";       // project's HTTP wrapper
import { getErrorMessage } from "@/lib/errors"; // project's error helper
import { notify } from "@/lib/notify";          // project's toast/snackbar

async function load() {
  setLoading(true);
  try {
    const data = await httpClient.get("/things");
    setRows(data);
  } catch (e) {
    notify.error(getErrorMessage(e, "Couldn't load"));
  } finally {
    setLoading(false);
  }
}
```

Centralize error → message mapping. Never inline `e?.response?.data?.detail || "Error"` everywhere.

## Accessibility (WCAG 2.1 AA minimum)

### Icon-only buttons
```html
<button aria-label="Delete user" title="Delete">
  <TrashIcon aria-hidden="true" />
</button>
```

### Form fields
```html
<label for="email">Email</label>
<input id="email" type="email" required />
```

Or wrap:
```html
<label>
  Email
  <input type="email" required />
</label>
```

### Color contrast
- Small text (under 18pt): ratio 4.5:1
- Large text (18pt+ or 14pt bold): ratio 3:1
- Test with browser devtools accessibility inspector

### Modals
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby="<title-id>"`
- Focus trap inside modal
- Esc closes
- Restore focus to invoking element on close
- Background scroll locked
- Click outside closes (unless data could be lost — then confirm)

### Keyboard navigation
- Tab moves through focusable elements in logical order
- Enter submits forms
- Esc closes modals/dropdowns
- Arrow keys for lists/grids (if appropriate)

## Touch targets (mobile)

- Minimum 44×44px (Apple HIG) / 48×48dp (Material)
- Adjacent targets need spacing (don't pack tightly)

## State persistence

- Form drafts: localStorage (per page)
- Filter state: URL query params (shareable, browser back works)
- Auth: secure cookie OR encrypted localStorage (never plain JWT in localStorage if XSS risk exists)

## Performance

- Images: framework's optimized component (Next/Image, Nuxt Image, etc.) — not raw `<img>`
- Code splitting: lazy load heavy routes
- Skeleton loaders during data fetch (no blank screens > 200ms)
- Debounce search inputs (300ms typical)

## Shared components (reuse, don't reinvent)

`CLAUDE.md` lists the project's shared components (Modal, PageHeader, DataTable, ConfirmDialog, Field, etc.). Use them. Don't roll your own unless explicitly needed.

If a shared component is missing a feature you need:
1. First option: extend the shared component (in a separate ticket — qa-reviewer will flag drift otherwise)
2. Second option: compose existing components
3. Last option: build new component (in a separate ticket)

## Common mistakes to flag

- ❌ Hardcoded `grid-cols-N` without breakpoint prefix → mobile broken
- ❌ Tables without overflow handling on mobile → horizontal scroll surprise
- ❌ Icon buttons without `aria-label` → screen readers confused
- ❌ `window.confirm()` instead of project's confirm dialog → ugly on mobile, no dark mode
- ❌ Raw fetch without timeout → UI hangs on slow network
- ❌ No loading state → blank screen during fetch
- ❌ `e?.response?.data?.detail || "Xato"` → unhelpful for non-axios errors
- ❌ `console.log` in shipped code → log spam, possible info leak

## Checklist (every UI ticket)

```
□ Works at 375 / 768 / 1280px
□ Mobile layout chosen (cards or horizontal scroll for tables)
□ Loading + empty + error states all 3
□ Icon-only buttons have aria-label
□ Forms have proper labels
□ Modal uses shared component (focus trap built-in)
□ Confirmations use shared dialog (not window.confirm)
□ API calls use project's HTTP client (timeout built-in)
□ Errors via project's error helper
□ Color contrast verified
□ Touch targets ≥ 44×44
□ No console.log in shipped code
□ No any types (or justified with comment)
□ Menu/route entry has permission declared
```
