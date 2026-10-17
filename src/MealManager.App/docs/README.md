# Frontend technical guide

[Setup and checks](../README.md) · [Product behavior](../../../docs/functional-overview.md) · [Cross-stack architecture](../../../docs/README.md) · [Localization](localization.md)

## Structure

Angular 22 standalone components use TypeScript 6, signals, RxJS, Tailwind CSS 4, DaisyUI 5, and Luxon. Vitest covers units/components, MSW supplies mock data, and Playwright covers production browser flows.

```text
src/app/
├── api/models/  Canonical API response contracts
├── core/        Authentication, routing, interceptors, and layout
├── features/    Pages, components, derived models, and state stores
└── shared/      Reusable presentation and UI primitives
src/mocks/       MSW handlers and in-memory fixtures
e2e/             Playwright tests against the production container
```

Features own their behavior and state; stores form the UI's HTTP boundary. Keep API models, stores, backend DTOs, mocks, and tests aligned. Requests use relative `/api` URLs through the development proxy or production host. Public terminology follows the [glossary](../../../docs/functional-overview.md#terminology).

## Shared presentation and state

Use DaisyUI components and Tailwind layout classes. Theme tokens and repeated surface/heading utilities live in `src/styles.css`; single-use styling stays in templates. Reuse FormField, Modal, EmptyState, SearchField, and AuthShell. FormField's compact spacing is for repeated authoring rows; ordinary forms use regular labels.

GroceryRow shares purchase quantity, editing, the item dialog, and CDK drag handles with Arrow Up/Down shortcuts. Profile/review adapters allow moves between Needed and Usually at home; Shopping-list rows reorder within their group. ReorderActions supplies direct arrows for ingredient/step authoring. Features own persistence, selection, and checkmarks.

Modal backdrop dismissal requires a pointer gesture starting and ending outside. `busy` blocks ordinary form dismissal; `beforeDismiss` guards meaningful drafts. Successful programmatic close bypasses both. Stale asynchronous decisions cannot close a newer session; nested dialogs restore focus within the parent. Export disables backdrop dismissal while loading/sending, while explicit Close allows the export to continue.

Catalog queries live in URL parameters. RecipeReturnContext retains the originating list and scroll position; restoration waits for loaded data, router scroll handling, and stable rendering. RecipePlanningContext retains a creation handoff in sessionStorage with an in-memory fallback. Planner rechecks its cycle/date before confirmation.

MobileAppBar hides on downward scrolling below 800px and returns on upward scrolling, navigation, or focus, respecting reduced motion. Desktop uses a fixed header and scrolling main pane. The document and main pane use fixed `scroll-pb-48` focus clearance; this is scroll alignment, not visible page padding. Creation actions survive first save through a local `new` query flag.

## Branding and assets

AppBrand owns the canonical restaurant glyph, soft secondary tile, Lora 500 wordmark, and compact/large proportions. Callers own link/heading semantics; DM Sans remains the body/control font. The glyph is defined in `shared/components/app-icon/app-icon.ts`.

Run `npm run icons:generate` after glyph/theme changes. It generates favicon, ICO, installable, maskable, and Apple touch icons with size-specific padding; never edit those assets by hand. The [social preview](../../../docs/assets/README.md) captures the rendered brand rather than maintaining another logo implementation.

## Cooking mode

CookingView owns a component-scoped CookingScreenLock. It requests a native wake lock in a visible secure context, releases stale grants on exit, and reacquires on visibility return only while cooking stays open. Rejected requests and system releases have truthful status notes. There is no offline service worker or automatic fullscreen request.

Hardware behavior still depends on browser and power settings; validate the household HTTPS origin on physical devices. Installation does not make an HTTP LAN origin secure.

## Mock development

Use `npm run start:mock` at `http://localhost:4200`. MSW intercepts relative API requests; all in-memory state resets on reload. Keep its validation, query parameters, response codes, and not-found behavior aligned with the backend.

Mock sign-in accepts nonempty credentials. Picnic starts connected without mappings; reconnect in Settings with `picnic@example.test`, password `Picnic123!`, and SMS code `123456`. Upload mocks check size/signatures and return a placeholder; they do not convert or persist images.

## Verification and production

See [frontend checks](../README.md#check) and [full-stack checks](../../../docs/development.md#verify-changes). Tests live beside source as `*.spec.ts`. Cover behavior, transformations, failure paths, and accessibility rather than mirroring implementation.

The production E2E suite builds the Docker image and uses its own Compose project, SQLite volume, and port `8081`, removed before/after the run. Docker and Playwright Chromium are required.

`npm run build` writes `dist/mealmanager/browser`. The API Dockerfile copies it into `wwwroot`, and ASP.NET Core serves the SPA and API from one origin.
