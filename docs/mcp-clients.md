# MealManager MCP reference

Optional Streamable HTTP tools at `/mcp` let a personal AI client work with household recipes, meal plans, groceries, and Shopping lists. [Server instructions](../src/MealManager.Api/Mcp/Instructions.md) are embedded in the API and sent during initialization.

## Configuration

Set `Mcp__Enabled=true` and `Mcp__AccessToken=<random secret of at least 32 characters>`, then restart. Clients send `Authorization: Bearer <token>`; invalid credentials receive `401 Unauthorized`. See the [Compose example](../docker-compose.example.yml).

The token grants household read/write access independently of web accounts. Store it as a deployment secret, keep the endpoint private, and use HTTPS across untrusted networks. Rotate it to revoke access.

## Workflows and contracts

| Purpose           | Tools and behavior                                                                                                                                                                                                                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Find recipes      | `search_recipes` returns a ranked shortlist by name, category, exact tags, favorites, or planning history. `list_recipe_catalog` provides paginated coverage with ingredients, profiles, and statistics. Choose the read that supplies the needed context.                                            |
| Discover tags     | `list_recipe_tags` returns exact household tag names and use counts. Every supplied tag filter must match.                                                                                                                                                                                            |
| Read history      | `list_recent_planning_cycles` returns complete cycles newest first. `limit` is 1–12, default 4; `beforeStartDate` is exclusive. Follow `nextBeforeStartDate` for older cycles.                                                                                                                        |
| Read/edit recipes | `get_recipe` and `get_recipe_profile` supply content and version tokens. `update_recipe` and `update_recipe_profile` patch omitted fields in place; supplied arrays replace their complete ordered contents, and empty arrays clear them. Retain known row IDs; omit IDs for new rows.                |
| Import recipes    | The client interprets the source and shows the recipe and Default profile for explicit approval. Call `create_recipe`, read the returned Default profile, then fill its confirmed `groceries` through `update_recipe_profile`. Recover an incomplete profile rather than creating a duplicate recipe. |
| Plan meals        | Read `get_active_meal_plan`, show an exact dated proposal for approval, then `create_planning_cycle` or `apply_meal_plan`. Precise user instructions can directly authorize their changes.                                                                                                            |
| Review groceries  | `review_meal_groceries` replaces a planned meal's explicit purchase selection. An empty `groceries` array confirms nothing to buy.                                                                                                                                                                    |
| Edit shopping     | `get_shopping_list` returns Other items in `items` and reviewed `mealGroups`, each containing `meal` metadata and `items`. Use `add_shopping_list_item`, `update_shopping_list_item`, and `remove_shopping_list_item`; identify the group and clarify ambiguous matches.                              |

Recipe statistics count original meals, excluding leftovers. `pastTimesPlanned` and `lastPastPlanned` use today and earlier; future counts are separate. They describe planned meals, not confirmed cooking. Follow `nextCursor` with unchanged filters for complete catalog/tag coverage.

Recipe/profile updates submit `expectedRecipeVersion` or `expectedProfileVersion` from the preceding read. `RecipeChanged` requires a fresh read and reconciliation. Profile payloads use `groceries` for reusable purchase defaults, distinct from ingredient measurements and supermarket products.

Complete plan writes submit `expectedMealPlanVersion` from `mealPlanVersion` (`none` without a cycle), all retained entries/notes, existing IDs, and unique client keys for new records. Omitted records are removed; array order sets within-day order. `MealPlanChanged` requires a new read and reconciliation. Read after a lost response before retrying.

Planning never adds groceries automatically. Changing a meal's profile clears its review; removing shopping items preserves the review and reusable profile groceries. Historical meal plans are read-only. See the [functional overview](functional-overview.md) for shared product rules. MCP does not fetch source URLs, import photos, track pantry/freezer inventory, or delete recipes/profiles.

## Verification

Against a running instance:

```powershell
./scripts/Test-McpEndpoint.ps1 -Url http://127.0.0.1:8080/mcp -Token $env:MEALMANAGER_MCP_TOKEN
```

Add `-ExerciseWrites` only for isolated data; it persists recipes, plans, and shopping items. For an isolated Docker build, workflow checks, and restart persistence:

```powershell
./scripts/Test-McpDocker.ps1
```

The script removes its temporary container and volume. Protocol tests verify contracts and persistence; client interpretation and user approval remain AI-client responsibilities.
