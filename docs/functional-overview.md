# MealManager functional overview

MealManager is a household app for reusable recipes, meal planning, and deliberate grocery shopping.

**Recipes → Plan meals → Review groceries → Shop**

This document describes the target behavior. Known implementation gaps are in [TODO.md](TODO.md); architecture and deployment are in the [technical guide](README.md).

## Recipes

### Recipe catalog

The household can browse, search, filter, create, edit, and favorite recipes. Cards show photos, titles, tags, categories, and planning statistics. Favorites are shared household state.

Categories are Meals (breakfast, lunch, dinner), Baking (bread, cakes, cookies, pastries), Desserts (other sweet dishes), Snacks, and Other (sauces and components). Occasion tags are optional.

Tags are reusable labels. Blank labels are rejected, and exact repeated names are stored once without changing their spelling or case. The editor suggests up to eight unselected tags by household use, with alphabetical ties, and supports searching or adding labels. Catalog tag filters require every selected tag to match.

Filters are applied together in a dialog, shown as a bottom sheet on mobile. Applied category, tag, and favorite filters remain visible and can be removed individually.

Sorting supports alphabetical order, most/least planned, and most/least recently planned. Frequency includes all original planned meals, including upcoming meals; leftovers do not count. Recency includes today and earlier. Never-planned recipes appear first for least recent and last for most recent. Ties use recipe names and identifiers. Cards omit upcoming-date metadata.

| Route               | Purpose |
| ------------------- | ------- |
| `/recipes`          | Catalog |
| `/recipes/new`      | Create  |
| `/recipes/:id`      | Details |
| `/recipes/:id/edit` | Edit    |

### Recipe details and editing

Recipes contain a title, category, tags, base servings, optional ingredients and preparation steps, photos, notes, and planning statistics. Empty ingredient and step sections show an empty state. Notes are plain text, preserve line breaks, are limited to 4000 characters, and are hidden when empty; URLs remain plain text.

Details prioritize the selected profile and cooking content. **Add to Planner** is the main action; **Edit Recipe** is in the recipe menu. Ingredients, steps, and profile groceries remain visible without section navigation.

The editor focuses newly added ingredient and step rows. Both lists support drag and keyboard reordering; saved order is used in details, and ingredient order also initializes profile groceries. Save actions remain reachable while scrolling, and focused fields stay clear of the footer and navigation. **Save and add another** saves and starts a fresh recipe.

A new recipe must be saved before photos can be uploaded; its first save keeps the editor open. Saved recipes upload selected photos immediately and show progress and the converted images. Photos are stored locally. Earlier/later controls set their saved order; the first photo is used in summaries and planning. Failed saves, uploads, or order updates retain the editor and allow retry.

Cooking statistics are outside the current scope. If introduced, they derive from past planned meals rather than separate cooked state.

### Recipe profiles

Profiles define reusable servings and purchase products. Ingredient quantities scale from the recipe's base servings; grocery quantities remain explicit whole purchase units. Profiles are independent of planning cycles.

Every recipe starts with a **Default** profile using its base servings, and must retain at least one profile. New profiles also start with base servings. One editor manages profile name, servings, and products. **Add Profile** remains visible; the profile menu offers Edit and, when another profile remains, confirmed removal.

Details show only populated grocery sections, preserving product order. The **Needed** heading is visible only when **Usually at home** products are also present; a needed-only list sits directly under Groceries. A populated **Usually at home** section keeps its heading. An empty profile shows one message while keeping Edit available. Editing and cart review retain both sections so products can be added to either. Products can be reordered by dragging or arrow keys and dragged between sections. Keyboard moves retain focus and announce the result. An empty profile can initialize products once from recipe ingredients without treating ingredient measurements as purchase quantities.

Recipes and profiles referenced by planned meals cannot be deleted, preserving planning history.

## Personal AI integration

An optional Model Context Protocol (MCP) endpoint lets a household use a personal AI client to browse recipes, labels, profiles, planning and groceries. With user intent, it can create and edit recipes and profiles, change favorites, create or correct planning, review groceries and edit the Shopping list.

MCP access uses a household integration credential. The web app's individual user logins remain separate; MCP activity is not attributed to a particular household member.

The AI client interprets external recipes. The user must review and explicitly confirm the proposed recipe and Default profile, including Needed and Usually at home products, before anything is saved. Missing quantities or units require clarification. MealManager does not fetch source URLs or store source photos through MCP.

Ingredient suggestions use household recipes and AI interpretation of synonyms and language differences. Missing ingredients, substitutions and uncertainty remain explicit. Availability is request-scoped and does not create pantry inventory.

For sparse planning requests, AI recommendations proactively read active and recent planning, statistics, favorites, tags, serving profiles, and linked leftovers. They balance household requirements with variety and avoid recent repeats where reasonable, without requiring a preferences questionnaire. Proposals may include meaningful alternatives and supported cooking-ahead/bulk opportunities; tags and profile sizes are hints, not guarantees or freezer inventory. Generated plans still require approval before writes.

Generated plans and corrections show the exact cycle range and proposed meals for approval before saving. New cycles follow the existing cycle defaults unless the user requests another range. Agreed changes preserve unrelated entries; concurrent changes require reconciliation. Precise user instructions can directly authorize corresponding changes.

Planning preferences use known labels and suitable profiles. Eating out uses a day note, cooking ahead uses linked leftovers, and freezer meal prep uses a bulk profile. Freezer inventory is not tracked.

Recipe and profile edits detect concurrent changes. Shopping items can be removed from Other items or an identified meal group without changing reusable products or grocery-review status. Regular product rules apply: planning never adds groceries, changing a selected profile clears grocery review, and confirming nothing to buy is valid. Historical planning remains read-only.

## Planner

The Planner displays a bounded cycle as a vertical timeline. Each day can have multiple meals and a contextual note. Notes belong to the day and can describe eating out, visitors, or other plans without creating a meal. Past days in the active cycle remain editable.

Meals show the recipe, image, category, profile, servings, and grocery-review status. Lightweight recipes without ingredients or steps support recurring choices such as freezer pizza. The meal options dialog offers profile changes, leftovers, moving, and removal.

### Planning cycles

The active cycle has the latest start date. A new cycle defaults to the day after the previous cycle ends and the active cycle's length. Dates can be adjusted; cycles may overlap, but a new cycle must start after every existing cycle's start date and may begin in the future. Start dates are unique.

The Planner and Shopping list share a browser-local cycle selection. Previous/next controls browse the complete history, show the year, retain selection while loading, and allow retry after a failed step. Controls are disabled while loading and at the ends of history. Dashboard reads the active cycle without changing this selection.

Historical planning is read-only: meal, note, leftover, reorder, and grocery-review actions are unavailable and rejected by the API. Recipes and review status remain visible, and historical Shopping lists remain editable.

Planning entries must stay within their cycle. Resizing cannot exclude meals, notes, or leftovers. Entries retain their within-day order across reloads; new entries append.

With no cycles, the Planner offers **Start first cycle**. Active cycles can be edited or deleted. Deletion is inside **Edit cycle**, requires confirmation, and removes that cycle's planning and Shopping list data while retaining recipes and profiles. Deleting the selected cycle opens the newest remaining cycle or the empty state.

### Moving meals and leftovers

**Move** opens a dialog to choose a day for meals or leftovers. The moved entry is added last after the destination day's meals and leftovers, including when moving within the same day. It supports keyboard use, restores focus to the entry's action button, and announces successful moves.

**Plan leftovers** creates a derived entry linked to an original meal on a later day. Leftovers show the original meal's weekday with a shared badge in Planner and Upcoming meals. Their options are Move and Remove leftovers; profile and grocery actions belong to the original meal.

A leftover must remain after its original. Moving either entry cannot violate that order. Removing a leftover deletes only that occurrence; removing an original also removes its groceries and all linked leftovers.

## Grocery-added state and cart flow

Planning a meal never adds groceries automatically. Its cart indicator opens an explicit **Add to cart** review with the recipe, profile, servings, and purchase products. The indicator distinguishes unreviewed meals from confirmed reviews.

**Needed** products start selected; **Usually at home** products start excluded. Users can select, add, edit, remove, or reorder purchase products. A manually added product starts selected even under Usually at home. Changes affect this purchase unless **Update the profile** is selected to save them as reusable defaults.

Add and Edit use the same name/quantity dialog. Add shows the selected group and initially focuses the name; Edit focuses the title and offers Remove below the fields without automatically opening a mobile keyboard. Note creation/editing follows the same focus policy. Enter submits from either field. Selecting a name suggestion fills the draft without saving, and failed additions retain their drafts.

Selections retain their source profile-product identifier, including after temporary name edits. Manual products have no source identifier. Reopening a review preserves the selection rather than restoring first-time defaults.

Confirming zero products records **nothing to buy** and gives the same reviewed state as a non-empty selection. Reviewed meals are excluded from the Shopping list's unreviewed-meal warning. Changing a planned meal's profile clears its grocery selection and requires another review.

## Shopping list

Each cycle has a Shopping list containing explicitly reviewed meal products and unrelated **Other items**. Meal groups appear without enclosing cards and retain the recipe link, image, profile, and servings, including when nothing is needed. Labeled **Add item** buttons sit below each meal list and Other items.

Users can add items to either kind of group, edit names and quantities, remove items, and check them as collected. Order is saved within each group; items cannot move between unrelated meal groups. Historical Shopping lists remain editable.

Below 800px, progress, unreviewed-meal warnings, and supermarket export appear immediately under the cycle selector, before the lists. Wider layouts show them in a sticky right sidebar. Both layouts use the same controls.

Grocery-name suggestions come from shopping history. Loading, empty, and error states keep manual entry available. The panel stays stable during lookup, and dismissed suggestions do not reopen when a pending response arrives. Selecting a suggestion changes only the name.

### Optional supermarket handoff

Shopping works without an integration. Administrators can connect one shared household account per supermarket; every member can use it. See [Picnic](picnic.md) for provider setup.

Export works for any cycle, to one connected supermarket at a time. Unchecked groceries start included; checked groceries can be included explicitly. Users choose available products and whole-pack quantities. Excluded rows remain visible, with editing disabled until reselected. An unreviewed-meal warning appears above the rows, and the footer explains that export adds to a cart without placing an order.

Each source row retains its pack quantity. Export combines identical supermarket products and validates the combined provider limit. Mobile places quantities below products; desktop uses a separate column. An estimated total appears only when every selected product has a known price in the same currency. Later MealManager edits do not synchronize the supermarket cart.

Confirmed additions check unchanged source groceries and save initial product choices per profile product and supermarket. Replacing a saved choice offers **This export only**, **Use next time too**, or **Back**; reusable choices change only after success. First-time choices, unchanged choices, and manual groceries skip this confirmation. Manual groceries have no reusable mapping, and pack quantities never change profiles.

Results show only **added** or **failed**. Errors and local-save warnings appear above a collapsed **Added products** section with checkmarks. Failed, unconfirmed, and skipped additions do not check groceries. Close the result and start a fresh export to try again. Confirmed products remain excluded during the browser session, even if local updates could not be saved. Failed requests refresh the list to pick up any server-confirmed additions and never automatically resend products.

Closing discards selections and results, but an export already running continues. Connections, saved product choices, and grocery checkmarks survive reloads. Duplicate additions remain possible after an unconfirmed cart response, a reload, or an export from another browser.

## Dashboard

The home page shows **Welcome home**, a localized date and greeting, active-cycle progress, **Coming up**, and **Household favorites**. Active-cycle actions open the Planner or start a cycle without changing a historical browsing selection.

In browser-local time, greetings are Good night (00:00–05:59), Good morning (06:00–11:59), Good afternoon (12:00–17:59), and Good evening (18:00–23:59).

Upcoming meals covers today and the next six days across cycles, displaying the next three meals or leftovers. Active progress counts planned entries and reviewed original meals, omitting review text when there are no originals. Favorites are shown four per carousel page in a 2×2 grid, ordered by original meal frequency in the last 90 days with alphabetical ties.

Favorite cards use bordered white surfaces, compact 16:10 photos, padded two-line titles, and a separate favorite action without category metadata.

## Users, configuration, and authentication

The app uses local email/password accounts and a server-side cookie session. First-run `/setup` creates the initial administrator; later sign-in uses `/login`. API access requires authentication, and administration requires the Admin role. Configuration supports reading setup state and first-run initialization.

The account dialog links administrators to **Settings**, containing Users and Supermarket integrations. Legacy `/users`, `/settings/users`, and `/settings/supermarkets` routes redirect there. Administrators can create, edit, and remove accounts, but cannot remove themselves or their administrator role. Removal requires confirmation. Members can use supermarket connections but cannot manage them. Closing a provider dialog clears unsaved password and verification drafts.

English and Dutch are available in the account, sign-in, and setup screens. Language selection is browser-local and takes effect after reload. First use matches a supported browser language or falls back to English. Routes stay in English; built-in text, common unit labels, dates, and numbers are localized. Household content and stored unit codes remain unchanged.

## Product principles

- Keep planning, explicit grocery review, and shopping distinct. Purchase changes must not silently alter reusable recipes or profiles.
- Use readable, warm cream and white surfaces, Lora headings, DM Sans body text, and caramel actions. Favorite cards keep their white surface on hover and use a border highlight. Cooking content uses 16px/24px body text; missing ingredients and steps use the same muted 14px/21px style. Recipe photo placeholders share the warm secondary background and contrasting restaurant icon.
- Use shared page empty states with muted icons, 16px semibold titles and 14px muted descriptions. Compact inline empty messages use the same 14px body typography. Metadata and navigation labels are at least 12px.
- Use DaisyUI’s standard status variants and soft error alerts, with theme colors, labels, and distinct icons. Tags and filters use secondary colors rather than success. Browser theme metadata matches the white app header.
- Below 800px, the mobile app bar hides on downward scrolling beyond its height and reappears on upward scrolling, near the top, on navigation, and when its controls receive keyboard focus. Its original space stays reserved to avoid layout shifts. Reduced-motion settings disable its transition. Labeled bottom navigation stays above the safe area. Wider layouts keep the header visible and use a compact sidebar.
- Use dialogs with a visible close control, scrolling content, reachable actions, and explicit destructive confirmations. Buttons use DaisyUI’s theme borders and default interaction states. Removal actions appear last with a trash icon and an error outline; destructive confirmations use solid error buttons. Primary actions retain caramel. Labels and icons distinguish removal actions as well as color. Sign-out uses error text.
- Keep errors explicit. Show success notifications when saving hides the result; avoid duplicate feedback when the change is already visible.
