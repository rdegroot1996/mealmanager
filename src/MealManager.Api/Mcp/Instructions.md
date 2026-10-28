# MealManager

MealManager manages recipes, reusable serving and grocery profiles, planning, linked leftovers, and shopping for one household. Treat it as the source of truth. Resolve IDs with reads before writes. Preserve unrelated data. Interpret natural-language requirements without requiring exact keywords. Do not invent recipe quantities, units, ingredients, profiles, or planning facts.

## Discovery and recommendations

- Use `search_recipes` for a targeted shortlist by name, category, exact tags, favorites, or planning-history sorting.
- Use `list_recipe_catalog` for complete paginated coverage and reasoning about ingredients or variety. Follow `nextCursor` with the same filters when complete coverage matters. Do not call both tools when one supplies the needed context.
- Catalog items include `isFavorite`, `pastTimesPlanned`, `lastPastPlanned`, and `upcomingTimesPlanned`. Past statistics count original meals dated today or earlier; upcoming counts are separate. MostPlanned/LeastPlanned count all original planned meals. Recency and the 90-day popularity ranking use past meals. Leftovers never count as another use. Planning does not prove a recipe was cooked.
- Use `list_recent_planning_cycles` to understand combinations, repetition, notes, and cooking-ahead patterns. It returns complete cycles newest first, defaulting to four cycles starting today or earlier. Use `beforeStartDate` for cycles preceding a proposal and `nextBeforeStartDate` to continue. Distinguish past entries from future dates within a returned cycle; cycles need not be weeks.
- Use `list_recipe_tags` and exact returned names for household tags. Follow its cursor if needed. Tags such as easy, simple, freezable, and bulk are hints, not guarantees. Every supplied tag is required, so avoid combining synonymous tags unless the user requires both.
- Interpret ingredient synonyms and language differences. Distinguish actual matches, missing ingredients, and suggested substitutions; make uncertainty explicit. Availability is request-scoped, not pantry inventory.
- Read shortlisted recipes and profiles for preparation steps, servings, and purchase quantities. Ingredient measurements scale from base servings; profile groceries are explicit whole purchase units, not scaled ingredient quantities.
- Balance user constraints, favorites, ingredients at home, profiles, planning frequency, recency, recent cycles, and variety within the proposal. Favorites are a preference signal. Do not always choose favorites or mechanically select the least-recently-planned recipes. Offer a primary choice and a few meaningful alternatives when useful.

Example: “I still have pasta, minced beef and a bell pepper.” Find suitable household recipes, explain which ingredients match and what else is needed, and identify substitutions rather than pretending the recipe contains them. Do not save pantry data or add groceries merely by recommending a meal.

## Meal planning

For sparse requests such as “Plan our next cycle”, proactively discover household context: active meal plan, recent cycles, catalog planning statistics, favorites, known tags, suitable serving profiles, and existing linked leftovers. Do not wait for the user to request these reads. Avoid recently planned meals where reasonable and vary recipe choices, ingredients, and preparation within the proposal. User constraints override variety; favorites are a preference, not an exclusive pool. With no history, use available recipe context without inventing preferences. Ask only about requirements that cannot be sensibly resolved.

Infer sensible cooking-ahead or bulk opportunities from profile servings and tags, and explain the assumption. Tags are hints, not guarantees of freezing suitability or available portions. Do not invent freezer inventory, create profiles, or increase servings without approval. Present the complete proposed dated plan, selected profiles/servings, and linked leftovers for approval before writing. Revisions remain conversational until approved, preserving unaffected choices.

1. Read `get_active_meal_plan` for the current inclusive range, entries, notes, and `mealPlanVersion`; without a cycle, its version is `none`.
2. Determine the requested dates and daily/cycle-wide requirements. Default a new cycle to the day after the previous end and the same length unless explicit dates override this. Clarify requirements that cannot be resolved from the request and household data.
3. Read recent cycles, known tags, and suitable recipe context. Account for remaining active meals as well as prior cycles. Consider variety in ingredients, preparation, and recipe choices without claiming unsupported nutritional or freezing facts.
4. Propose exact inclusive cycle dates and dated meals, profile servings, notes, and linked leftovers. Include meaningful alternatives where helpful. Show generated plans and corrections for approval before writes. Precise user requests authorize their corresponding edits; do not ask again for an already-approved proposal.
5. Persist the complete agreed plan with `create_planning_cycle` for a new cycle or `apply_meal_plan` for the active cycle, using the read `mealPlanVersion`. Include all retained entries and notes, existing IDs, and unique client keys for new records. Omitted entries and notes are removed. Individual meals, leftovers, notes, and grocery reviews in historical cycles remain editable; whole-plan replacement targets the active cycle.
6. Reconcile `MealPlanChanged` with a fresh read. If a response is lost, read before retrying: creation is not safely repeatable. After saving, briefly confirm the actual result.

Example: “Tuesday we eat out, Wednesday cook for Thursday too, Friday cook bulk to freeze portions.” Tuesday uses a day note. Wednesday uses an appropriate larger profile, with Thursday a `Leftover` linked to Wednesday's original meal. Friday uses a suitable bulk profile; clarify or propose creating one if none fits. Freezer inventory is not tracked. Use recent cycles to avoid repeating the same meals every week and explain alternatives that still satisfy the requirements.

Treat an uncommitted proposal as conversational working state. For “something easier on Wednesday” or “not pasta twice,” preserve unaffected choices, original constraints, and dependent leftovers. Show the revised result before saving when approval is needed; do not persist intermediate brainstorming.

## Recipe import and creation

Categories are Meals, Baking, Desserts, Snacks, and Other. Baking covers bread, cakes, cookies, and pastries, even when served as dessert. Breakfast/lunch/dinner occasions can be optional tags. Recipes may have no ingredients or steps: reusable choices such as freezer pizza or a snack platter can be simple recipes with a serving profile. Use day notes for occasional snack nights or eating out when no reusable meal or grocery group is needed.

Preserve a supplied source reference or cooking tips in the optional plain-text Notes field (maximum 4000 characters). Do not add a separate source field or fetch URLs. In edits, omitted notes are preserved and an empty string clears them.

1. Interpret the supplied text, image, or source into recipe fields and ordered rows. The client handles sources; MealManager does not fetch URLs or import source photos through MCP.
2. Preserve supplied quantities and units. Missing quantities or units require clarification. Apply requested substitutions or omissions and use existing exact tags rather than creating synonyms.
3. Validate base servings, ingredient measurements, steps, and the proposed Default profile with servings, Needed groceries, and Usually at home groceries. Purchase quantities must be positive whole units. Show the recipe and Default profile before any write.
4. Call `create_recipe` only after explicit user confirmation of the interpreted recipe and profile. It creates an empty Default profile with base servings.
5. Read the returned Default profile with `get_recipe_profile`, then fill confirmed groceries using `update_recipe_profile` and its version. If this second step fails, read and repair that existing profile; do not recreate the recipe. Explain any incomplete result.

Example: “Add this pasta recipe for four, with pasta and mince to buy and oil usually at home.” Verify recipe quantities separately from purchase pack counts, present the recipe and profile, then save the approved data. This does not add items to a cycle's shopping list.

## Recipe and profile editing

- Read `get_recipe` and submit `recipeVersion` as `expectedRecipeVersion`. Omitted fields stay unchanged; supplied ingredient, step, and tag arrays replace the complete lists. Preserve existing row IDs, ordered rows, and tags unless removal was requested; omit IDs for new rows.
- Read `get_recipe_profile` and submit `profileVersion` as `expectedProfileVersion`. Supplied groceries replace the complete ordered grocery list; preserve unaffected groceries and IDs.
- Recipe base-serving changes do not alter profile servings or purchase quantities. Use `create_recipe_profile` for a confirmed new variation. A profile must match the request; do not assume Default or invent bulk/freezing suitability.
- On a version conflict, read and reconcile rather than overwrite. `set_recipe_favorite` sets household-wide preference state.
- MCP does not delete recipes/profiles or manage photos.

## Groceries

Planning a meal never adds groceries. Commit grocery review only on explicit request, separately from planning.

- Read the selected profile's groceries and inspect existing shopping before changing it. Respect Usually at home flags while allowing user adjustments. Confirming nothing to buy is a valid completed review.
- Review groceries on the original meal, not its linked leftovers. Leftovers do not create another purchase selection. Changing the original's profile clears its review; removing it removes its grocery selection and linked leftovers.
- `get_shopping_list` separates Other items from meal groups. For changes identify Other items or the recipe and meal date; clarify ambiguous matches. Remove or update shopping items without changing reusable profile groceries. Removing an item does not reset grocery-review status.
- Historical shopping lists remain editable. Pantry and freezer inventory are not tracked.

## Authorization and completion

Read-only discovery and recommendations need no confirmation. Show generated recipe imports and meal plans before persisting them. Make destructive or broad replacement results clear; preserve unrelated data and respect existing authorization. After a write, briefly confirm what changed, including partial failures requiring repair.
