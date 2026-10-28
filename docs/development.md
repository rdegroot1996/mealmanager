# Development

[Project](../README.md) · [Frontend](../src/MealManager.App/README.md) · [Technical guide](README.md)

## Local setup

### Prerequisites

- [.NET SDK 10](https://dotnet.microsoft.com/download/dotnet/10.0), as selected by `global.json`
- Node.js 24 LTS
- npm 12

Install the frontend dependencies and start the Angular development server:

```powershell
cd src/MealManager.App
npm ci
npm start
```

In a second terminal, from the repository root, restore and start the API with frontend proxying enabled:

```powershell
dotnet restore mealmanager.slnx
$env:PROXY_FRONTEND = "1"
dotnet run --project src/MealManager.Api/MealManager.Api.csproj
```

Open `https://localhost:7111`. On a new database, MealManager directs you to `/setup` to create the first administrator. The API reference is available at `https://localhost:7111/api/scalar`.

For frontend work without a backend, run `npm run start:mock` instead of `npm start` and open `http://localhost:4200`.

## Verify changes

For backend changes, from the repository root:

```powershell
dotnet build mealmanager.slnx --no-restore
dotnet test --solution mealmanager.slnx --no-restore
dotnet format whitespace mealmanager.slnx --no-restore --verify-no-changes
dotnet format style mealmanager.slnx --no-restore --severity hidden --diagnostics IDE0005 IDE0051 IDE0052 IDE0059 IDE0060 --verify-no-changes
dotnet tool restore
dotnet ef migrations has-pending-model-changes --project src/MealManager.Infrastructure --startup-project src/MealManager.Api --no-build
git diff --check
```

For frontend changes, from `src/MealManager.App`:

```powershell
npm test
npm run build
```

The browser end-to-end suite requires Docker. Install its browser once with `npm run test:e2e:install`, then run `npm run test:e2e` from the frontend directory.

Run `npm run test:e2e:deployment` separately for backup/restore and production asset checks.

See the [frontend checks](../src/MealManager.App/README.md#check) for translation,
type, and formatting checks.

The API serves the compiled Angular app in production. See the [deployment guide](deployment.md).
