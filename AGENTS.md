# MealManager agent guide

MealManager is a household meal-planning app with an Angular frontend and an ASP.NET Core/.NET backend. The backend serves the compiled frontend and stores household data in SQLite.

This file contains repository-wide working instructions for coding agents. It is not project documentation. Use these canonical sources instead of duplicating durable knowledge here:

- [README.md](README.md): human-facing project introduction and setup
- [Functional overview](docs/functional-overview.md): intended product behaviour
- [Technical guide](docs/README.md): architecture, engineering constraints, and deployment
- [Implementation tracker](docs/TODO.md): known gaps between the documented target and current code

Read the functional overview before changing behaviour and the relevant technical-guide section before changing architecture, tooling, persistence, security, or deployment. More specific `AGENTS.md` files add instructions for their directory trees.

## Working rules

- State assumptions and product tradeoffs before changing behaviour.
- Explore the existing code and tests before changing behaviour.
- Choose the simplest change that meets the request; avoid speculative abstractions.
- Keep edits scoped to the request and define verifiable success criteria.
- Prefer small end-to-end changes. Keep Angular models, state stores, MSW handlers, API DTOs, controllers, commands or queries, persistence, and tests aligned when a contract crosses those boundaries.
- Surface product decisions before implementing them. Record settled behaviour in `docs/functional-overview.md` and durable technical decisions in `docs/README.md`.
- Add a focused `docs/TODO.md` item only for a deliberate or durable gap. Remove the item when the gap closes.
- Preserve unrelated work and do not silently broaden the requested scope.

## Validation strategy

- During implementation, run the smallest relevant test or check that covers the changed behaviour. Do not repeatedly run broad suites after each small edit.
- Before final handoff, run the complete validation relevant to the touched area once, and report any checks that were not run. A full repository-wide validation is reserved for changes that cross those boundaries or an explicit release-level request.
- Run browser E2E only when a covered browser flow, authentication, persistence, or production integration is affected. Prefer the directly affected spec while iterating; run the relevant suite once before handoff.
- Visual review is opt-in, not a default frontend validation step. Use it only when the user explicitly asks for visual review or the requested change has plausible rendered-UI risk, such as layout, responsive behavior, dialogs, navigation, images, overlap, overflow, contrast, or a browser workflow whose failure needs rendered-state investigation. Do not invoke, mention, or install the visual-review skill for non-rendered changes or merely because frontend files changed. Unless investigation requires earlier browser evidence, perform one targeted visual-review pass near final handoff rather than repeating it throughout implementation.
- When visual review is warranted, use the repository-owned `mealmanager-visual-review` skill under `.agents/skills`; otherwise use the smallest relevant automated checks.
- For agent-performed browser work, use Playwright CLI and its installed workspace skills. Before first use in a checkout, run `playwright-cli install --skills`; its generated `.claude/skills/playwright-cli` files are intentionally ignored.
- Prefer screenshot-free Playwright CLI validation using accessibility snapshots, DOM state, computed styles, element bounds, overflow measurements, and console/network checks. Capture and inspect only the changed surface, and only when the user explicitly requests visual judgment or when CLI evidence cannot establish the rendered result; do not use screenshots as the default proof for functional browser checks.
- Use Playwright MCP only for a targeted screenshot that is still needed after those CLI checks; do not use it for routine navigation, browser validation, or E2E investigation.

## Product invariants

- Historical meal plans and Shopping lists remain editable. Adding from a recipe page always targets the active cycle.
- Adding a planned meal never adds groceries automatically. Grocery review is explicit and may confirm that nothing must be bought.
- Changing a planned meal's recipe profile invalidates its grocery selection.
- Deleting a planned meal removes its grocery selection and leftover relationships.
- Leftovers are derived entries linked to an original meal; destructive, cart, and profile actions belong to the original.
- Authentication uses SQLite-backed ASP.NET Core Identity users, a server-side cookie session, and antiforgery protection.

## Backend work

- Keep controllers thin. Mutations belong in Application commands and reads in queries.
- Keep EF Core entities as simple mutable data objects; put business rules and cross-aggregate coordination in Application.
- Keep response DTOs separate from mutation DTOs and use domain verbs such as `Create`, `Add`, `Plan`, and `Update` for requests.
- Prefer EF Core conventions. Schema changes require a generated migration under `src/MealManager.Infrastructure/Migrations`; never edit generated migrations or the model snapshot by hand.
- Use central package management. Restore repository-local tools with `dotnet tool restore` before EF commands.

Before final handoff for backend changes, run:

```powershell
dotnet build mealmanager.slnx --no-restore
dotnet test --solution mealmanager.slnx --no-restore
dotnet format whitespace mealmanager.slnx --no-restore --verify-no-changes
dotnet ef migrations has-pending-model-changes --project src/MealManager.Infrastructure --startup-project src/MealManager.Api --no-build
git diff --check
```

Keep integration tests focused on API behaviour rather than EF Core's generated schema.
