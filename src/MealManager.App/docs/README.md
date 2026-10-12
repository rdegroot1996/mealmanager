# Frontend technical guide

[Setup](../README.md) · [Product behavior](../../../docs/functional-overview.md) · [Cross-stack architecture](../../../docs/README.md) · [Localization](localization.md) · [Agent rules](../AGENTS.md)

## Stack

- Angular 22 with standalone components
- TypeScript 6
- RxJS and Angular signals
- Tailwind CSS 4 and DaisyUI 5
- Luxon for date handling
- Vitest for unit and component tests
- MSW for browser-local API mocks
- Playwright for browser end-to-end tests

## Architecture

```text
src/app/
├── api/models/  Canonical API response contracts
├── core/        Authentication, routing, interceptors, and application layout
├── features/    Feature pages, components, services, models, and state stores
└── shared/      Reusable presentational components and UI primitives
src/mocks/       MSW handlers and in-memory test data
e2e/             Playwright tests against the production container
```

Features own their pages, feature components, derived models, and state. State stores form the normal boundary between the UI and HTTP API. Shared API response contracts live in `src/app/api/models`, which keeps one canonical frontend representation of each backend response.

Application-wide concerns belong in `core`; reusable presentation belongs in `shared`. Reuse shared UI primitives and prefer default DaisyUI components with Tailwind layout utilities. Theme tokens live in `src/styles.css`; shared `@utility` styles cover repeated surfaces, headings, recipe titles, and recipe placeholders. Keep single-use styles in their templates. Use `btn-error` for removal, add `btn-outline` for secondary actions, and use `alert-error alert-soft` for error feedback. Use the theme’s global border width and avoid component overrides.

`ProductRow` shares quantity, reordering, editing, and the item dialog. Shopping and meal review adapters own their checkbox semantics; features own state and persistence.

Below 800px, `MobileAppBar` hides on downward scrolling and returns on upward scrolling, navigation, or keyboard focus. It respects reduced motion. Mobile routes restore Back/Forward positions after rendering; bottom navigation stays above the safe area. Desktop uses a fixed header and a scrolling main region.

The application calls relative `/api` URLs. This lets the same frontend run through the ASP.NET Core development proxy and from the production host without environment-specific API base URLs.

## Development details

The project declares `npm@12.0.2` and supports Node.js 22.22.3+ or 24.15.0+.

Install dependencies and start the Angular development server:

```powershell
npm ci
npm start
```

The development server listens on `http://localhost:4200`. For full-stack development, also run the API with `PROXY_FRONTEND=1` and open the API address; the [development guide](../../../docs/development.md#local-setup) contains the complete command.

### Mock API

Run the frontend without a backend using MSW:

```powershell
npm run start:mock
```

The mock configuration replaces the no-op `src/start-mocks.ts` with `src/mocks/start-mocks.ts`, starts the browser service worker, and handles relative `/api` requests with the handlers in `src/mocks`.

Mock mode starts with Picnic connected and no saved product mappings. Disconnect or reconnect in **Settings → Supermarket integrations** using `picnic@example.test`, password `Picnic123!` and SMS code `123456`. State resets on page reload.

Mock recipe uploads reject empty files, files over 10 MB, and unsupported image signatures so upload errors and retry can be exercised. Accepted uploads return an app-icon placeholder; mock mode does not decode, resize, convert, or persist image files. Mock sign-in accepts non-empty credentials and does not validate a real account password.

When an API contract or behaviour changes, update its model, feature store, MSW handler, backend contract, and relevant tests together. Mock responses should reproduce the backend's status codes, validation, query parameters, and not-found behaviour closely enough that mock development does not hide integration errors.

## Testing and verification

Run unit and component tests with Vitest and create a production build:

```powershell
npm test
npm run build
```

Use `npm run typecheck` for TypeScript static analysis, `npm run format:check` to verify Prettier formatting, or `npm run format` to apply it.

Tests live beside their source as `*.spec.ts`. Prefer testing user-visible behaviour, state transformations, loading and error paths, and accessibility interactions rather than implementation details.

### Browser end-to-end tests

Playwright tests build and launch the production Docker image, so Angular is served by ASP.NET Core exactly as it is in deployment. Docker must be running.

Install Chromium once, then run the suite:

```powershell
npm run test:e2e:install
npm run test:e2e
```

The suite uses its own Docker Compose project, SQLite volume, and port `8081`. Its resources are removed before and after a run.

## Production build

### App icons

The `restaurant` path definition in `src/app/shared/components/app-icon/app-icon.ts` is the canonical MealManager glyph. Run `npm run icons:generate` after changing that path or the icon theme colours. The generator produces the browser favicon, installable PNG icons, maskable icon, Apple touch icon, and ICO file; do not edit those generated assets by hand.

`npm run build` writes the browser bundle to `dist/mealmanager/browser`. The repository Dockerfile copies that output into the published ASP.NET Core application's `wwwroot`, and the backend provides SPA fallback for non-API routes.

The production application therefore has one public origin and one deployable container even though frontend and backend development remain separated.
