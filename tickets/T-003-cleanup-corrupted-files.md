# T-003 — Cleanup: Delete .corrupted Frontend Files

## Goal
Remove all `.corrupted` stub files that have a valid replacement `.tsx` already present, and verify the remaining working pages render without errors.

## Owner Role
`frontend-dev`

## Depends On
`none` (parallel with T-001, T-002)

## Estimated Size
S

## Files Likely Touched
Delete these files (each has a working `.tsx` sibling confirmed by glob):
- `apps/web/app/(dashboard)/warehouse/types/page.tsx.corrupted`
- `apps/web/app/(dashboard)/warehouse/internal-transfers/page.tsx.corrupted`
- `apps/web/app/(dashboard)/warehouse/write-off/page.tsx.corrupted`
- `apps/web/app/(dashboard)/warehouse/write-off-reason/page.tsx.corrupted`
- `apps/web/app/(dashboard)/warehouse/revision/page.tsx.corrupted`
- `apps/web/app/(dashboard)/warehouse/recommended-stock/page.tsx.corrupted`

DO NOT modify any working `.tsx` page — only delete the `.corrupted` twins.

## Acceptance Criteria
- [ ] All 6 `.corrupted` files deleted from the repository.
- [ ] `git status` shows only deletions, no modifications to existing `.tsx` files.
- [ ] Each corresponding working page still loads in browser at 1280px without console errors.
- [ ] No 404s introduced in menu navigation.

## How We'll Know It's Done
`find apps/web -name "*.corrupted"` returns zero results. All warehouse menu items load without blank screens.
