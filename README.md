# MealManager

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

Self-hosted recipes, meal planning, and shopping lists for one household.

**Recipes → Plan meals → Review groceries → Shop**

## What you can do

- **Keep your recipes together.** Save ingredients, preparation steps, photos,
  and notes. Find recipes by category, tags, or shared household favorites.
- **Reuse serving profiles.** Scale ingredient quantities for different serving
  sizes and keep reusable grocery products for each profile.
- **Plan meals and leftovers.** Organize flexible planning cycles with multiple
  meals per day, day notes, and leftovers linked to the original meal. Browse
  previous cycles to revisit your plans.
- **Decide what to buy.** Review each meal's groceries, including products you
  usually have at home. Planning never adds groceries automatically, and
  confirming nothing to buy is valid.
- **Shop from one list.** Keep meal groceries and other items together, edit
  quantities, and check off purchases. The dashboard shows upcoming meals and
  household favorites.
- **Share with your household.** Use individual local accounts and English or
  Dutch on mobile and desktop.

Optional integrations let you send groceries to a [Picnic cart](docs/picnic.md)
without placing an order, or use a [personal AI client through MCP](docs/mcp-clients.md)
to help manage recipes, plans, and shopping.

## Get started

Angular and ASP.NET Core run together in one Linux container, with SQLite and
local photo storage. MealManager is intended for a household on a trusted network.

- [Run with Docker](docs/deployment.md#docker)
- [Develop locally](docs/development.md#local-setup)
- [Frontend with a mock API](src/MealManager.App/README.md#run)

A new installation opens setup for the first administrator. Keep `/app/data`
persistent and use HTTPS for normal deployment; see the deployment guide.

## Documentation

- [Product behavior](docs/functional-overview.md)
- [Technical guide](docs/README.md)
- [Frontend guide](src/MealManager.App/README.md)
- [Open work](docs/TODO.md)

Coding-agent instructions are in [AGENTS.md](AGENTS.md), with additional
[frontend instructions](src/MealManager.App/AGENTS.md).

[Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

## License

[Apache License 2.0](LICENSE).
