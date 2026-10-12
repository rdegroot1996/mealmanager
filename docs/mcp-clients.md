# MealManager MCP reference

MealManager exposes optional Streamable HTTP tools at `/mcp` for household recipes, planning and groceries.

Server instructions live in [Instructions.md](../src/MealManager.Api/Mcp/Instructions.md), embedded in the API and supplied to clients during initialization.

## Configuration

Set `Mcp__Enabled=true` and `Mcp__AccessToken=<random secret of at least 32 characters>`, then restart MealManager. Clients must send `Authorization: Bearer <token>`; missing or invalid credentials receive `401 Unauthorized`. The [Compose example](../docker-compose.example.yml) includes these settings.

The token grants household read and write access, separate from web logins. Store it as a deployment secret, keep the endpoint private, and use HTTPS across untrusted networks. Rotate the token to revoke access.

## Recipe and planning workflows

- **Discovery:** `search_recipes` returns a bounded shortlist by name, labels, favorites and planning-history sorting. `list_recipe_catalog` supplies complete paginated coverage with ingredients, profiles, `isFavorite`, `pastTimesPlanned`, `lastPastPlanned` and separate `upcomingTimesPlanned` for broader ingredient and variety reasoning. Use whichever supplies the needed context rather than automatically calling both. `list_recipe_tags` supplies household labels. Follow `nextCursor` with the same filters for complete coverage. History counts original meals dated today or earlier, not leftovers, future meals, or confirmed cooking.
- **Recent history:** `list_recent_planning_cycles` returns complete cycles newest first with dates, meals, profiles, linked leftovers and day notes. `limit` defaults to four (1–12); omit `beforeStartDate` for cycles starting today or earlier, or supply an exclusive boundary for cycles preceding a proposal. Pass `nextBeforeStartDate` as the next boundary for older history. Cycles need not be seven days. Distinguish elapsed entries from future dates within returned cycles.
- **Import:** Show the proposed recipe and Default profile, including Needed and Usually at home products. Only after explicit confirmation, call `create_recipe`, then read its Default profile and fill it with `update_recipe_profile`. Recover that profile if its update fails. Source interpretation happens in the client; MCP does not fetch URLs or ingest photos.
- **Editing:** One `update_recipe` tool edits recipe fields, ingredients and steps. Omitted fields stay unchanged; supplied lists replace their contents. Retain existing row IDs and omit IDs for new rows. Profiles are edited separately. Submit `recipeVersion` as `expectedRecipeVersion`, or `profileVersion` as `expectedProfileVersion`. A `RecipeChanged` error requires a fresh read and reconciliation.
- **Planning:** Read `get_active_planning`, then show the exact inclusive cycle range and dated proposal for approval. New cycles normally start after the previous cycle and keep its length; explicit dates override this. Use known labels, day notes for eating out, linked leftovers for cooking ahead, and bulk profiles for freezer prep.
- **Saving:** `create_planning_cycle` accepts an initial plan; `apply_planning` replaces the active plan. Submit the read `planningVersion` (`none` when no cycle exists), all retained entries and notes, existing IDs, and unique client keys for new records. Omitted records are removed. On `PlanningChanged`, read and reconcile; after a lost response, read before retrying.

`get_grocery_list` separates Other items from meal groups, identifying each meal's recipe, date and profile. Items in either group can be removed. The AI should identify the group when making changes and clarify ambiguous matches. Removal changes shopping only; recipe/profile products and grocery-review status are preserved.

Planning never adds groceries automatically. Grocery review is explicit, including nothing to buy. Historical planning is read-only. MCP does not track pantry or freezer inventory or delete recipes and profiles.

## Verification

Check authentication, initialization and tool discovery against a running instance:

```powershell
./scripts/Test-McpEndpoint.ps1 -Url http://127.0.0.1:8080/mcp -Token $env:MEALMANAGER_MCP_TOKEN
```

Add `-ExerciseWrites` only with isolated test data; it persists recipes, plans and groceries.

To build and test the full application in Docker, including restart persistence:

```powershell
./scripts/Test-McpDocker.ps1
```

This uses a temporary container and volume, then removes both. The scripts test HTTP contracts and persisted workflows; confirmation and semantic interpretation are verified in the connected AI client.

Sparse planning requests trigger proactive household discovery before proposing a plan. Generated plans require approval before persistence. Recipes support plain-text Notes for source references or tips; an omitted notes edit preserves content and an empty string clears it. Category values are Meals, Baking, Desserts, Snacks, and Other. Search supports frequency sorting across all scheduled original meals and recency sorting based on past meals.
