# MealManager frontend

Angular frontend, served by the ASP.NET Core backend in production.

## Run

Requires Node.js 22.22.3+ or 24.15.0+ and npm 12 (project version: 12.2.1).
From this directory:

```powershell
npm ci
npm run start:mock
```

Open http://localhost:4200. Mock data resets on reload.
For the real API, use `npm start` and the [full-stack setup](../../docs/development.md#local-setup).

## Check

```powershell
npm run i18n:check
npm run typecheck
npm run format:check
npm test
npm run build
```

Browser E2E requires Docker: install Chromium with `npm run test:e2e:install`.

```powershell
npm run test:e2e             # User journeys
npm run test:e2e:deployment  # Backup/restore and production assets
```

## Guides

- [Frontend architecture, mocks, and tests](docs/README.md)
- [Localization](docs/localization.md)
- [Product behavior](../../docs/functional-overview.md)
- [Agent instructions](AGENTS.md)
