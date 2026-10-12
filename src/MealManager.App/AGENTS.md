# MealManager frontend agent guide

These instructions apply under `src/MealManager.App`. Read the repository [AGENTS.md](../../AGENTS.md) first. Product behaviour is canonical in the [functional overview](../../docs/functional-overview.md); setup commands are in this directory's [README.md](README.md), and durable frontend architecture is in the [frontend technical guide](docs/README.md).

## Architecture

- Put product behaviour under its owning feature in `src/app/features`; do not move feature-specific code into `shared`.
- Use feature state stores as the UI's API boundary. Pages and components request work from their store instead of calling `HttpClient` directly.
- Keep canonical API response types in `src/app/api/models`. Use feature-local models only for derived UI state.
- When an API contract changes, update the Angular model, store, MSW handler, backend DTO, and relevant tests together.
- Prefer standalone components and signals for local synchronous state; use RxJS for asynchronous API flows.

## UI and accessibility

Reuse existing shared primitives before creating another abstraction:

| Need                             | Preferred primitive                        |
| -------------------------------- | ------------------------------------------ |
| Standard action                  | Native `button` with DaisyUI `btn` classes |
| Label, hint, or validation error | `app-form-field`                           |
| Search input                     | `app-search-field`                         |
| Empty or no-results state        | `app-empty-state`                          |
| Login or setup shell             | `app-auth-shell`                           |
| Dialog shell                     | `app-modal`                                |

Use DaisyUI and Tailwind directly for specialized controls and one-off layout. Extract shared UI only when repeated behaviour and structure justify a stable shared API.

Define semantic status colors in DaisyUI theme tokens and use its standard component variants. Keep one-off overrides in templates; add a shared `@utility` only when repeated styling warrants it. Avoid a global utilities-layer override of DaisyUI status components.

Compose surfaces with the semantic utilities defined in `styles.css`:

- `app-surface` for bordered white cards and panels.
- `app-inset` for bordered, shadow-free rows or callouts inside another surface.
- Keep layout classes separate, and use colour, borders, or rings—not stronger shadows—for status emphasis.

- Give every form control an accessible name. When using `app-form-field`, keep its `controlId` identical to the projected control's `id`.
- Give icon-only controls an explicit accessible label and hide decorative icons from assistive technology.
- Keep sizing and responsive variants together on the native control, for example `btn-xs lg:btn-sm`. Preserve intentional breakpoint sizing when migrating controls; do not split it between wrapper inputs and caller overrides.
- Shared components own repeated behavior or structure, not class forwarding. Keep domain selectors and meal actions in their owning features. Recipe summaries own their title typography, while their parent owns page layout.
- Keep `RecipeSummary` focused on recipe content and its shared image, metadata, and title presentation. Its parent owns surrounding layout and feature actions.
- Do not nest interactive controls. Preserve keyboard operation, native button types, disabled states, focus behaviour, and meaningful loading and error feedback.
- Prefer native semantics; add ARIA only when native HTML is insufficient.
- Treat the `restaurant` paths in `app-icon.ts` as the canonical app-logo glyph. Run `npm run icons:generate` after changing the glyph or icon theme colours; do not hand-edit generated favicon or installable icon assets.

## Testing and verification

- Add focused Vitest tests beside the source as `*.spec.ts` for behaviour, transformations, and error paths.
- Keep MSW handlers aligned with actual API validation, query names, response codes, and not-found behaviour.
- Scope reads to their owning page, widget, or modal session so stale responses cannot overwrite a newer selection. Mutations capture their target before starting and refresh it only while it remains selected.
- Use Playwright for important cross-feature flows, authentication or persistence behaviour, and regressions that unit tests cannot cover. Prefer role, label, and visible-text locators.
- Browser and visual validation are not required for every frontend change. Use `playwright-cli` only when the requested change affects a covered browser flow, authentication/persistence integration, or needs rendered-state investigation. Use the MealManager visual-review skill only when visual review is explicitly requested or the change has plausible rendered-UI risk; do not invoke it for non-rendered changes merely because frontend files were edited. Unless browser evidence is needed during investigation, batch this into one targeted pass near final handoff. Prefer accessibility, DOM, layout, console, and network evidence; take a screenshot only for visual judgment of the changed surface. Run `playwright-cli install --skills` only when that browser work is actually needed; use MCP only for a targeted screenshot that remains necessary.
- While iterating, run the focused affected specs and an appropriate build or type check; do not repeatedly run the full suite after every small edit.
- Before final handoff, run `npm test` and `npm run build` once for frontend changes, unless the change is documentation-only or the user narrows validation. Report any omitted check.

Run this final frontend validation from this directory:

```powershell
npm ci
npm run typecheck
npm run i18n:check
npm run format:check
npm test
npm run build
```

Run `npm run test:e2e` once before handoff when the change affects a covered browser flow or production integration; Docker must be running. While iterating, prefer the directly affected spec.
