# MealManager technical guide

[Setup](../README.md) · [Product behavior](functional-overview.md) · [Open work](TODO.md) · [Agent rules](../AGENTS.md)

## Architecture

One Linux container serves the Angular frontend and ASP.NET Core API, with SQLite and local image storage. Intended for one household on a trusted network.

- **Api:** HTTP controllers, authentication, SPA hosting, OpenAPI.
- **Application:** commands, queries, validation, DTOs, business rules.
- **Domain:** mutable entities and contracts.
- **Infrastructure:** EF Core, Identity, storage, external adapters.
- **Common:** errors and serialization.

Controllers remain thin. Mutations use commands; reads use queries. API errors expose stable ProblemDetails codes translated by the frontend. Keep backend contracts, Angular models, stores, mocks, and tests aligned.

.NET packages use `Directory.Packages.props`. Keep `EfCoreVersion` and the local `dotnet-ef` tool version aligned.

### Model Context Protocol

Optional `/mcp` access uses a household bearer token, separate from web sessions. Tools call Application use cases; version checks and transactions protect recipe and meal-plan writes. See [configuration and contracts](mcp-clients.md).

### Supermarket integrations

`ISupermarketProvider` adapters own authentication and cart APIs. Provider connections use protected tokens in SQLite `AppSettings`; product mappings are unique per profile grocery item and provider.

Exports validate the reviewed list and connection. Only acknowledged additions update unchanged groceries and mappings. Cart mutations are never retried automatically. See [Picnic](picnic.md).

## Persistence and images

`PlanningCycle`, `MealPlan`, and `ShoppingList` are separate roots coordinated by Application commands. Meals and linked leftovers share one ordered planning-entry hierarchy. Reordering uses transactions and temporary positions. An explicit grocery-review record distinguishes unreviewed meals from confirmed empty selections.

Meal groceries retain nullable profile-grocery identifiers; deleting a source grocery item preserves shopping history. Referenced recipes and profiles cannot be deleted. Ingredients use decimal quantities; purchase quantities use whole units.

Mutation row DTOs are separate from response DTOs. Ingredient, step, and profile-grocery replacement arrays define their order. Creation assigns server IDs; REST updates accept retained IDs and new client-generated UUIDs, rejecting duplicate IDs or IDs owned by another recipe or profile. MCP updates require known retained IDs and omit IDs for new rows.

Images are stored under `recipe-images`, with metadata in SQLite. Magick.NET validates JPEG, PNG, WebP, GIF, HEIC/HEIF content, normalizes orientation, fits images within 1600 × 1200 without upscaling, flattens transparency on white, strips metadata, and encodes JPEG at quality 85. Upload limits are 10 MB and 40 megapixels.

Startup applies EF migrations. Generate changes under `src/MealManager.Infrastructure/Migrations`; never edit generated migrations or snapshots.

## Authentication and HTTP security

ASP.NET Core Identity uses a persistent 14-day sliding cookie. API access requires authentication; administration requires the Admin role. Setup creates the first administrator. State-changing requests require antiforgery protection. Browser storage contains no credentials.

Production requires HTTPS. For TLS termination, set `ASPNETCORE_FORWARDEDHEADERS_ENABLED=true` and keep port `8080` private to the proxy. Trusted-network HTTP may use `Authentication__AllowInsecureHttp=true`.

## Frontend architecture

Angular calls relative `/api` URLs. One build supports English and Dutch with browser-local language selection. The [frontend technical guide](../src/MealManager.App/docs/README.md) covers state, shared controls, mocks, and tests; [localization](../src/MealManager.App/docs/localization.md) has its own guide.

The manifest supports home-screen installation; household data remains server-backed, with no offline service worker.

## Development and deployment

- [Development](development.md): full-stack setup and checks.
- [Frontend](../src/MealManager.App/README.md): frontend commands and guides.
- [Deployment](deployment.md): Docker, HTTPS, storage, and backup.
