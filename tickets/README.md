# tickets/

Sprint-level workspace. AI build-team agents read from here.

## Layout

| Phase | File | Author | Content |
|---|---|---|---|
| 0 | `SDLC.md` | static (committed) | Sprint checklist — `cto` re-reads after every step |
| 1 | `SPEC.md` | `pm` | One-page proposal: intent, acceptance criteria (Given/When/Then), OUT OF SCOPE |
| 2 | `T-1-<slug>.md`, `T-2-<slug>.md`, ... | `pm` | Each ticket: goal, files, done criteria, owner, depends-on |
| 3 | `DESIGN.md` | `architect` | Approach, file layout, DB changes, API contract |

## Sprint kickoff example

User:
> "pm: add MXIK code field to products"

`pm` → `SPEC.md` + `T-1-add-mxik-column.md`, `T-2-mxik-product-form-field.md`, `T-3-receipt-include-mxik.md`

User:
> "architect: design it"

`architect` → `DESIGN.md` (column type, API shape, UI field placement)

User:
> "cto: schedule and run"

`cto` → schedule table → dispatches `backend-dev` (T-1) and `frontend-dev` (T-2) in parallel → `qa-reviewer` each → re-dispatch if needed → T-3 sequentially → reports done → awaits user approval → ARCHIVES to `specs/archive/`

## File naming conventions

- One sprint = one `SPEC.md` + one `DESIGN.md` (if applicable). Starting a new sprint? Archive previous first via `cto` ARCHIVE phase.
- Ticket files: `T-<num>-<short-slug>.md`. Numbering resets per sprint.
- After archive, tickets/ is empty (except SDLC.md and README.md) for the next sprint.

## Never store secrets here

- Real passwords, tokens, API keys: never. Reference env var names only (`<ENV_VAR_NAME>`).
- Real user data: anonymize (`user@example.com`, `+998 90 XXX XX XX`).

## What about specs/?

`specs/` is the **archive + canonical library**:
- `specs/archive/YYYY-MM-DD-<slug>/` — sealed sprint packages (SPEC + DESIGN + tickets + REVIEW + HUMAN-APPROVAL)
- `specs/modules/<module>.md` — canonical "single source of truth" per module (updated after major changes)
- `specs/templates/` — SPEC.template.md, DESIGN.template.md, REVIEW.template.md

`tickets/` = current sprint scratchpad. `specs/` = permanent record.

## Manual override

If you want to start a sprint without `pm`, write your own `SPEC.md` (using `specs/templates/SPEC.template.md` as guide), then invoke `architect` / `cto` directly.
