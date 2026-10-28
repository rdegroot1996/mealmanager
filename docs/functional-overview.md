# MealManager functional overview

MealManager helps one household keep recipes, plan meals, decide what to buy, and build a shopping list.

**Plan meals → Review groceries → Build your shopping list**

This document defines product behavior and terminology. See the [technical guide](README.md) for implementation and [TODO.md](TODO.md) for known gaps.

## Terminology

Use these English terms in documentation, code, contracts, and tests. UI translations belong in locale catalogs. Short names such as Profile and Cycle are appropriate when their context is clear.

| Term                 | Meaning                                                                                                                 | Code name                  |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Recipe               | Reusable choice with optional cooking content; includes cakes, sauces, and ready-made options, not only complete meals. | `Recipe`                   |
| Category             | One required, fixed classification: Meals, Baking, Desserts, Snacks, or Other.                                          | `RecipeCategory`           |
| Tag                  | Reusable household-defined classification, such as Easy or Vegetarian. A recipe can have several.                       | `RecipeTag`                |
| Recipe profile       | Reusable servings and grocery defaults for a recipe.                                                                    | `RecipeProfile`            |
| Ingredient           | Cooking measurement; its quantity scales with servings.                                                                 | `RecipeIngredient`         |
| Profile grocery item | Reusable purchase default with a whole quantity and Needed or Usually at home placement.                                | `RecipeProfileGroceryItem` |
| Planner              | Screen for viewing and editing a cycle's meal plan.                                                                     | `/planner`                 |
| Planning cycle       | Bounded, inclusive date range; not necessarily a calendar week.                                                         | `PlanningCycle`            |
| Meal plan            | A cycle's meals, linked leftovers, and day notes.                                                                       | `MealPlan`                 |
| Planned meal         | An original recipe/profile choice for a date; does not confirm cooking happened.                                        | `PlannedMeal`              |
| Planned leftovers    | Derived occurrence linked to an earlier original meal.                                                                  | `PlannedLeftover`          |
| Day note             | Text attached to a date in a meal plan.                                                                                 | `PlanningDayNote`          |
| Grocery review       | Explicit purchase decision for a planned meal, including nothing to buy.                                                | `MealGroceryReview`        |
| Shopping list        | A cycle's reviewed meal groups and independent Other items.                                                             | `ShoppingList`             |
| Shopping-list item   | Name, whole purchase quantity, order, and collected state in that list.                                                 | `ShoppingListItem`         |
| Supermarket product  | Provider offering with a product ID, pack size, availability, price, and limit.                                         | `SupermarketProduct`       |
| Export               | Add selected supermarket products to an external cart without placing an order.                                         | Provider `Send` operation  |

Categories and tags are separate. There is no additional classification called a label; ordinary form and accessibility labels retain their usual meaning. Groceries describe what the household needs to buy; products describe supermarket offerings. Needed and Usually at home are defaults, not pantry inventory or collected-item states.

## Recipes

### Library and cooking content

The household can create, search, filter, sort, edit, and favorite recipes. Favorites are shared. Categories distinguish Meals, Baking, Desserts, Snacks, and Other; tags express occasions, effort, or preferences without more fields.

Recipes require a name, category, and base servings. Ingredients, ordered steps, photos, tags, and plain-text notes are optional. Notes preserve line breaks and accept up to 4000 characters; URLs remain plain text. Recipes without cooking content can still be planned. Details hide empty cooking sections.

Recipe-name search is case-insensitive and treats search characters literally. Search updates after a short pause; Enter and clearing search act immediately. Category, tags, favorites, search, and sorting combine. Every selected tag must match. Exact repeated tag names are stored once without changing spelling or case; suggestions use household frequency and alphabetical ties. Filters and sorting are represented in the catalog URL. Returning from details restores the originating catalog, Planner, or Shopping list and its position within the app session; direct links fall back to Recipes. Recipe links from planned meals, leftovers, upcoming meals, and Shopping groups select the planned profile so cooking quantities match the meal. Invalid profile links fall back to the default with an explanation.

Sorts cover name, planning frequency, and recency. Frequency counts all original meals, including future ones; recency uses today and earlier. Leftovers never count. Never-planned recipes come first for least recent and last for most recent; ties use name and ID.

The editor marks required fields and keeps save actions reachable. Validation identifies and focuses invalid fields. Ingredients and steps use move arrows with keyboard shortcuts, preserve focus, and announce order changes. Photos use earlier/later controls; the first photo appears in summaries. A recipe must be saved before uploading photos. First save keeps creation open so photos can be added; Save and add another remains available until creation finishes. Direct editing omits that action. Failed operations preserve drafts and permit retry.

### Recipe profiles

Every recipe starts with a Default profile at its base servings and must retain at least one profile. Profiles have a name, servings, and ordered groceries. Ingredient amounts scale with servings; grocery quantities count packs or individual items and stay fixed when servings change.

The profile menu offers Add, Edit, and confirmed removal when another profile remains. The grocery section's Edit profile shortcut opens the same editor. Referenced recipes and profiles cannot be deleted, preserving meal-plan history.

Profiles divide groceries into Needed and Usually at home. Details show populated sections only; the editor retains both and identifies them as groceries for this profile. Empty profiles are valid. Start with recipe ingredients is offered only for an empty profile and copies ingredient names at purchase quantity 1 without converting measurements. Drag handles and Arrow Up/Down reorder groceries, including between sections; there are no reorder context-menu commands.

### Cooking mode

Recipes with ingredients or steps offer Cooking mode beside the first populated cooking section. It shows the title, selected profile/servings, scaled ingredients, and steps. Back to recipe returns to details and restores focus to the opener.

Cooking mode automatically requests a browser screen wake lock. A compact notice reports requesting, active, paused, or unavailable state; only an active lock claims the screen stays on. Returning to a visible page reacquires it while cooking mode remains open; leaving releases it. Browser, HTTPS, policy, and system limitations can prevent it. Installation is optional and does not provide offline household data.

## Planner

The Planner shows a cycle as a timeline with multiple meals per day and one day note, for example eating out or visitors. Meals, notes, grocery reviews, and Shopping lists are editable in every cycle. The active cycle has the latest start date.

New cycles default to the day after the preceding cycle and retain its length; the first defaults to today through six days later. Cycles may overlap or start in the future, but new cycles must start after every existing start date. Resizing the active cycle must preserve its identity as the latest cycle, unique starts, and all entries within range. Creation also creates an empty meal plan and Shopping list. Removing the active cycle requires confirmation and removes its associated data; historical cycles cannot be removed. Planner and Shopping list share a browser-local cycle selection and offer Return to active cycle; Dashboard does not change that selection.

Planning from the Planner requires a recipe, profile, and date inside the selected cycle. Adding from a recipe page always targets the active cycle, independently of the browsing selection. The dialog rechecks its target before adding. Without a cycle, the recipe-page action offers first-cycle creation and returns to explicit meal confirmation. An empty meal-picker search offers creation with the searched name while retaining the cycle, day, and query. Saving still permits photos; continuing returns to explicit meal/profile confirmation. Creation alone never plans a meal or adds groceries. The destination is rechecked before saving.

Meals and leftovers share ordered positions within a day. Moving chooses a date and appends the entry, preserves focus, and announces success. Leftovers must follow their original meal; moves cannot violate that relationship. Leftovers offer Move and Remove; profile and grocery actions belong to the original. Removing an original requires confirmation explaining that its review, shopping items, and any linked leftovers will be removed. Removing a leftover affects only that occurrence.

## Grocery review

**Planning a meal never adds groceries automatically.** Review groceries opens the chosen profile and the meal's purchase selection. Needed defaults to selected; Usually at home defaults to excluded. Added items start selected in either section. Users can adjust names, whole quantities, selection, order, and section.

Changes apply to this meal unless Also update profile is selected to save reusable defaults. Temporary edits retain their source profile-grocery identifier; manual items have none. Reopening preserves the saved selection. Changing the planned meal's profile clears its selection and review, with a warning before the change.

Actions say Add N items to shopping list for first review, Update shopping list for existing review, or Confirm nothing to buy for an empty selection. Counts refer to selected rows. Empty review is complete and distinguishable from an unreviewed meal. Supermarket export remains a separate whole-list action.

## Shopping list

Each cycle has reviewed meal groups and Other items. Groups retain their recipe link, date, profile, and servings even when empty. Users can add, edit, remove, reorder, and check off items. Drag handles and arrow keys reorder within a group; items cannot move between unrelated meal groups. Historical lists stay editable. Name suggestions come from shopping history and fill the draft without saving.

Progress, export, and a separate missing-review banner summarize the list. Every cycle offers Review in planner for unfinished grocery reviews. Mobile places status before the lists; wider layouts use a sidebar. Empty, loading, and error states keep manual entry available.

### Optional supermarket handoff

Shopping works without an integration. Administrators connect one shared account per provider; members can use it. See [Picnic](picnic.md) for setup.

Export works for any cycle. Unchecked items start included; checked items can be included explicitly. Each row chooses an available supermarket product and whole-pack quantity. Excluded rows stay visible. Identical products combine for export, with combined provider limits checked. An estimate appears only when all selected prices are known in one currency. The footer reports missing choices, invalid quantities, conflicts, or no selections above one export action.

Only acknowledged additions check unchanged shopping items. Successful initial choices are remembered per profile grocery item and supermarket. Replacing a remembered product offers This export only or Use next time too; mappings change only after success. Manual items have no reusable mapping. Pack quantities never change profiles; later edits never synchronize the external cart.

Failures, uncertain responses, and skipped additions stay unchecked; requests are not automatically retried. Results separate added products from failures and local-save warnings. Completion actions do not resend. Closing discards local selections/results, while an export already running continues. Duplicate additions are possible after an uncertain response or a later export; the app does not reconcile existing cart contents.

## Dashboard

The time-of-day greeting addresses the signed-in user by their full display name, falling back to a generic greeting when no name is available.

Dashboard shows active-cycle progress, upcoming meals, and household favorites without changing the selected historical browsing cycle. The planning widget always describes and opens the active cycle. Upcoming meals starts today and shows the next three entries across cycles, independently of the selected cycle. Favorites appear four per page, ordered by original-meal frequency over 90 days and then name. Progress counts entries and reviewed original meals.

## Accounts

### Sign-in and permissions

First-run setup creates the first administrator. Local email/password accounts use server-side sessions. Administrators manage users and settings; members use household features. Administrators cannot delete themselves or remove their own Admin role. Account removal requires confirmation.

Five failed sign-ins block the account for five minutes.

### Passwords

All new passwords require 6+ characters with A–Z, a–z, a digit, and a symbol. Change password requires the current password. Initial account passwords do not require replacement. Forms identify invalid fields and focus the first error.

### Recovery

Administrators reset another user's password to a temporary password, clearing lockout and existing sessions. Temporary sign-in requires replacement on a standalone page with Sign out. See [host recovery](deployment.md#administrator-recovery) for administrator access.

## Language

English is the default UI language; see the [localization guide](../src/MealManager.App/docs/localization.md) for supported translations. Selection is browser-local and takes effect after reload. Dates, numbers, units, and built-in text are localized; household content, routes, and stored unit codes stay unchanged.

## Personal AI integration

Optional [MCP access](mcp-clients.md) uses a household credential separate from web accounts. Clients can discover recipes, tags, profiles, and meal plans; edit supported content; plan meals and leftovers; review groceries; and edit Shopping lists.

Generated plans and imported recipes require review and explicit approval before writes; precise instructions can directly authorize corresponding changes. Clients interpret sources and ingredient synonyms, explain uncertainty, and never invent missing measurements. MealManager does not fetch recipe URLs or import photos through MCP.

Recommendations consider active/recent plans, favorites, tags, profiles, and variety. Tags and larger profiles are hints, not guarantees of effort, freezing suitability, or inventory. Version checks reject concurrent edits and require reconciliation. Product invariants apply equally through MCP.

## Interface conventions

- Use sentence-case actions and familiar glossary terms. Keep errors explicit; avoid duplicate success feedback when results remain visible.
- Use warm cream/white surfaces, caramel actions, Lora headings and MealManager wordmark, and DM Sans body/control text. The shared brand component owns the glyph, soft secondary tile, and compact/large proportions.
- Keep repeated field, section, row, and Add-button spacing consistent. Ordinary forms use regular labels; ingredient rows use compact spacing. Preserve accessible names, focus, keyboard operation, and announcements.
- Mobile uses a hide-on-scroll app bar and labeled bottom navigation above the safe area; desktop keeps the header/sidebar visible. Respect reduced motion and restore navigation positions.
- Skip to content appears on keyboard focus and bypasses recurring navigation.
- Dialogs have Close, scrolling content, and reachable actions. Close, Escape, and backdrop dismissal protect meaningful drafts with Keep editing / Discard changes. Nested dismissal affects only the top dialog. Ordinary mutations block dismissal; export's explicit Close retains its continuing-operation behavior.
