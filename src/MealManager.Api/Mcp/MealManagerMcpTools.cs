using MealManager.Api.Mcp.Contracts;
using MealManager.Application.Mapping;
using System.ComponentModel;
using System.Text.Json;
using FluentValidation;
using MealManager.Common.Enums;
using MealManager.Common.Errors;
using ModelContextProtocol;
using ModelContextProtocol.Server;

namespace MealManager.Api.Mcp;

[McpServerToolType]
public sealed class MealManagerMcpTools(
    RecipeDiscoveryQueries recipeDiscoveryQueries,
    RecipeCatalogQueries recipeCatalogQueries,
    RecipeQueries recipeQueries,
    RecipeProfileQueries recipeProfileQueries,
    PlanningCycleQueries planningCycleQueries,
    PlanningQueries planningQueries,
    PlanningStateQueries planningStateQueries,
    GroceryListQueries groceryListQueries,
    RecipeCommands recipeCommands,
    RecipeEditCommands recipeEditCommands,
    RecipeProfileCommands recipeProfileCommands,
    PlanningReplacementCommands planningReplacementCommands,
    PlanningMealCommands planningMealCommands,
    GroceryListCommands groceryListCommands,
    IServiceProvider services)
{
    [McpServerTool(Name = "search_recipes", Title = "Search recipes", ReadOnly = true, Destructive = false, OpenWorld = false, UseStructuredContent = true)]
    [Description("Find a bounded shortlist by name, category, exact labels, favorites or planning-history sorting. Use list_recipe_catalog for complete paginated coverage and broader ingredient or meal-variety reasoning. Avoid reading both when one provides the needed context.")]
    public Task<McpRecipeSearchResponse> SearchRecipes(
        [Description("Optional recipe-name search text.")] string? search = null,
        [Description("Optional recipe category.")] RecipeCategory? category = null,
        [Description("Optional tags. A recipe must have every supplied tag.")] string[]? tags = null,
        [Description("When true, return only household favorites. When false, exclude favorites.")] bool? favorite = null,
        [Description("Sort order: Name, LeastPlanned, MostPlanned, LeastRecentlyPlanned, MostRecentlyPlanned, or RecentPlanningPopularity. Frequency counts all original planned meals; recency uses past meals.")] RecipeSearchSort sort = RecipeSearchSort.Name,
        [Description("Maximum number of recipes to return, from 1 through 50.")] int limit = 20) =>
        Execute(async () => new McpRecipeSearchResponse
        {
            Recipes = await recipeDiscoveryQueries.SearchRecipes(new RecipeSearchOptions
            {
                Search = search,
                Category = category,
                Tags = tags ?? [],
                Favorite = favorite,
                Sort = sort,
                Limit = Math.Clamp(limit, 1, 50),
            }),
        });

    [McpServerTool(Name = "list_recipe_catalog", Title = "List recipe catalog", ReadOnly = true, Destructive = false, OpenWorld = false, UseStructuredContent = true)]
    [Description("Read household recipes with ordered ingredients, profile summaries, isFavorite, pastTimesPlanned and lastPastPlanned. History counts original meals dated today or earlier, not leftovers or future meals; it is planned, not confirmed cooking history. Follow nextCursor for complete coverage and ingredient/variety reasoning. Use search_recipes for a targeted ranked shortlist. Get shortlisted recipes/profiles for steps and purchase products.")]
    public Task<RecipeCatalogPageDto> ListRecipeCatalog(
        [Description("Continuation returned by this tool with the same filters. Omit for the first page.")] string? cursor = null,
        [Description("Number of recipes per page, from 1 through 50.")] int pageSize = 50,
        [Description("Optional category constraint requested by the user.")] RecipeCategory? category = null,
        [Description("Exact known label names; every supplied tag is required.")] string[]? tags = null,
        [Description("True includes favorites only; false excludes favorites; omitted includes both.")] bool? favorite = null) =>
        Execute(() => recipeCatalogQueries.ListRecipes(new RecipeCatalogOptions
        {
            Cursor = cursor,
            PageSize = pageSize,
            Category = category,
            Tags = tags ?? [],
            Favorite = favorite,
        }));

    [McpServerTool(Name = "list_recipe_tags", Title = "List recipe labels", ReadOnly = true, Destructive = false, OpenWorld = false, UseStructuredContent = true)]
    [Description("List existing recipe labels and distinct recipe-use counts across the whole household. Follow nextCursor for all labels. Use exact returned names to interpret preferences; tag filters require every supplied label. Labels have no shared identifier.")]
    public Task<RecipeTagPageDto> ListRecipeTags(
        [Description("Continuation returned by this tool. Omit for the first page.")] string? cursor = null,
        [Description("Number of labels per page, from 1 through 50.")] int pageSize = 50) =>
        Execute(() => recipeCatalogQueries.ListTags(cursor, pageSize));

    [McpServerTool(Name = "get_recipe", Title = "Get recipe", ReadOnly = true, Destructive = false, OpenWorld = false, UseStructuredContent = true)]
    [Description("Get one recipe and recipeVersion for editing, with its ordered ingredients, preparation steps, profile summaries, images, favorite state, and planning statistics.")]
    public Task<RecipeStateDto> GetRecipe(
        [Description("Recipe identifier returned by search_recipes.")] Guid recipeId) =>
        Execute(async () => (await recipeQueries.GetRecipe(recipeId)).ToState());

    [McpServerTool(Name = "get_recipe_profile", Title = "Get recipe profile", ReadOnly = true, Destructive = false, OpenWorld = false, UseStructuredContent = true)]
    [Description("Get a recipe profile and profileVersion for editing, with its servings and ordered grocery products, including which products are usually at home.")]
    public Task<RecipeProfileStateDto> GetRecipeProfile(
        [Description("Recipe profile identifier returned by search_recipes or get_recipe.")] Guid profileId) =>
        Execute(async () => (await recipeProfileQueries.GetRecipeProfile(profileId)).ToState());

    [McpServerTool(Name = "get_active_planning", Title = "Get active planning", ReadOnly = true, Destructive = false, OpenWorld = false, UseStructuredContent = true)]
    [Description("Read the active cycle's inclusive range, meals, linked leftovers, notes, profiles and grocery-review state. Use planningVersion when submitting a proposed plan or a new cycle. Without a cycle, cycle/planning are null and planningVersion is none. Read again after writes or conflicts.")]
    public Task<PlanningStateDto> GetActivePlanning() => Execute(() => planningStateQueries.GetActivePlanning());

    [McpServerTool(Name = "list_recent_planning_cycles", Title = "List recent planning cycles", ReadOnly = true, Destructive = false, OpenWorld = false, UseStructuredContent = true)]
    [Description("Read recent complete cycles newest first, with dated meals, profiles, linked leftovers and day notes. Defaults to cycles starting today or earlier, including future dates within those cycles; distinguish past plans from future entries. Follow nextBeforeStartDate as beforeStartDate for older cycles. History is planned, not confirmed cooking. Read active planning separately before writes.")]
    public Task<RecentPlanningCyclesDto> ListRecentPlanningCycles(
        [Description("Maximum cycles, 1 through 12; default 4.")] int limit = 4,
        [Description("Exclusive cycle start-date boundary. Omit for recent history; use a proposed cycle start to inspect preceding cycles.")] DateOnly? beforeStartDate = null) =>
        Execute(() => planningCycleQueries.ListRecentPlanningCycles(limit, beforeStartDate));

    [McpServerTool(Name = "get_grocery_list", Title = "Get grocery list", ReadOnly = true, Destructive = false, OpenWorld = false, UseStructuredContent = true)]
    [Description("Get shopping for a cycle; omit cycleId for the active cycle. groceries contains Other items. planningMealGroceries contains meal groups with the original meal ID, date, recipe name, profile and grocery items. Each item's planningMealId identifies its meal or is null for Other items.")]
    public Task<GroceryListDto> GetGroceryList(
        [Description("Optional planning-cycle identifier. Omit it for the active cycle.")] Guid? cycleId = null) =>
        Execute(async () =>
        {
            var resolvedCycleId = cycleId ?? (await planningCycleQueries.GetCurrentPlanningCycle()).Id;
            return await groceryListQueries.GetCycleGroceryList(resolvedCycleId);
        });

    [McpServerTool(Name = "create_recipe", Title = "Create recipe", ReadOnly = false, Destructive = false, OpenWorld = false, UseStructuredContent = true)]
    [Description("Create a household recipe from already-analyzed structured data. When importing an external source, call only after the user reviewed and explicitly confirmed the interpreted recipe and Default profile. Do not invent missing quantities or units. Creates an empty Default profile with base servings; read that profile with get_recipe_profile, then fill it using update_recipe_profile with the confirmed Needed and Usually at home products.")]
    public Task<RecipeStateDto> CreateRecipe(
        [Description("Recipe name.")] string name,
        [Description("Recipe category.")] RecipeCategory category,
        [Description("Base number of servings, greater than zero.")] int baseServings,
        [Description("Reusable household tags.")] string[] tags,
        [Description("Ordered recipe ingredients with decimal quantities and measurement units.")] McpRecipeIngredientInput[] ingredients,
        [Description("Ordered preparation-step descriptions.")] string[] steps,
        [Description("Optional plain-text notes or source reference, up to 4000 characters.")] string? notes = null) =>
        Execute(async () =>
        {
            var command = new CreateRecipeDto
            {
                Name = name,
                Notes = notes,
                Category = category,
                BaseServings = baseServings,
                Tags = tags,
                Ingredients = ingredients.Select(ingredient => new RecipeIngredientInputDto
                {
                    Id = Guid.Empty,
                    Name = ingredient.Name,
                    Quantity = ingredient.Quantity,
                    Unit = ingredient.Unit,
                }).ToArray(),
                Steps = steps.Select(description => new RecipeStepInputDto
                {
                    Id = Guid.Empty,
                    Description = description,
                }).ToArray(),
            };
            await Validate(command);
            return (await recipeCommands.CreateRecipe(command)).ToState();
        });

    [McpServerTool(Name = "update_recipe", Title = "Update recipe", ReadOnly = false, Destructive = true, OpenWorld = false, UseStructuredContent = true)]
    [Description("Patch one recipe, including ingredients and steps, in one operation. Read get_recipe first and supply its recipeVersion. Omitted fields are preserved; supplied arrays replace the complete ordered list and empty arrays clear it. Preserve existing row IDs; omit IDs for new rows. Images, favorites and profiles are preserved; base-servings changes do not change profile servings or purchase products.")]
    public Task<RecipeStateDto> UpdateRecipe(
        [Description("Existing household recipe identifier.")] Guid recipeId,
        [Description("recipeVersion returned by get_recipe. On conflict, read and reconcile.")] string expectedRecipeVersion,
        [Description("Optional replacement title.")] string? name = null,
        [Description("Optional replacement category.")] RecipeCategory? category = null,
        [Description("Optional replacement base servings.")] int? baseServings = null,
        [Description("Optional complete replacement labels. Empty clears labels.")] string[]? tags = null,
        [Description("Optional complete ordered ingredients. Empty clears ingredients.")] McpRecipeIngredientUpdateInput[]? ingredients = null,
        [Description("Optional complete ordered steps. Empty clears steps.")] McpRecipeStepUpdateInput[]? steps = null,
        [Description("Optional replacement notes. Omit to preserve; empty string clears. Maximum 4000 characters.")] string? notes = null) =>
        Execute(() => recipeEditCommands.PatchRecipe(new PatchRecipeDto
        {
            RecipeId = recipeId,
            ExpectedRecipeVersion = expectedRecipeVersion,
            Name = name,
            Notes = notes,
            Category = category,
            BaseServings = baseServings,
            Tags = tags,
            Ingredients = ingredients?.Select(row => row is null || row.Id == Guid.Empty
                ? throw new ValidationException("Ingredient rows cannot be null; omit IDs for new rows.")
                : new RecipeIngredientInputDto { Id = row.Id ?? Guid.Empty, Name = row.Name, Quantity = row.Quantity, Unit = row.Unit }).ToArray(),
            Steps = steps?.Select(row => row is null || row.Id == Guid.Empty
                ? throw new ValidationException("Step rows cannot be null; omit IDs for new rows.")
                : new RecipeStepInputDto { Id = row.Id ?? Guid.Empty, Description = row.Description }).ToArray(),
        }));

    [McpServerTool(Name = "set_recipe_favorite", Title = "Set recipe favorite", ReadOnly = false, Destructive = false, Idempotent = true, OpenWorld = false, UseStructuredContent = true)]
    [Description("Set or clear the household-wide favorite state for one recipe.")]
    public Task<RecipeSummaryDto> SetRecipeFavorite(
        [Description("Recipe identifier.")] Guid recipeId,
        [Description("Desired favorite state.")] bool isFavorite) =>
        Execute(() => recipeCommands.SetFavorite(recipeId, new SetRecipeFavoriteDto { IsFavorite = isFavorite }));

    [McpServerTool(Name = "create_recipe_profile", Title = "Create recipe profile", ReadOnly = false, Destructive = false, OpenWorld = false, UseStructuredContent = true)]
    [Description("Create a reusable serving and grocery-product profile for a recipe. Product quantities are whole purchase units, not recipe ingredient measurements.")]
    public Task<RecipeProfileStateDto> CreateRecipeProfile(
        [Description("Recipe identifier.")] Guid recipeId,
        [Description("Profile name, such as Four people or Vegetarian.")] string name,
        [Description("Number of servings, greater than zero.")] int servings,
        [Description("Ordered grocery products for this profile.")] McpProfileProductInput[]? products = null) =>
        Execute(async () =>
        {
            if (products?.Any(product => product is null || product.Id.HasValue) == true)
                throw new ValidationException("New profile products must omit IDs and cannot be null.");
            var command = new AddRecipeProfileDto
            {
                RecipeId = recipeId,
                Name = name,
                Servings = servings,
                Products = ToProfileProducts(products ?? []),
            };
            await Validate(command);
            return (await recipeProfileCommands.AddRecipeProfile(command)).ToState();
        });

    [McpServerTool(Name = "update_recipe_profile", Title = "Update recipe profile", ReadOnly = false, Destructive = true, OpenWorld = false, UseStructuredContent = true)]
    [Description("Patch a recipe profile using profileVersion from get_recipe_profile. Retained product IDs must be unique and belong to this profile; omit IDs for new products. Omitted fields are preserved; supplying products replaces the complete ordered product list, and an empty list clears it.")]
    public Task<RecipeProfileStateDto> UpdateRecipeProfile(
        [Description("Recipe profile identifier.")] Guid profileId,
        [Description("profileVersion returned by get_recipe_profile. On conflict, read and reconcile.")] string expectedProfileVersion,
        [Description("Optional replacement profile name.")] string? name = null,
        [Description("Optional replacement serving count.")] int? servings = null,
        [Description("Complete replacement products. Retain existing IDs; omit IDs for new products. Empty clears products.")] McpProfileProductInput[]? products = null) =>
        Execute(() => recipeEditCommands.PatchProfile(new PatchRecipeProfileDto
        {
            ProfileId = profileId,
            ExpectedProfileVersion = expectedProfileVersion,
            Name = name,
            Servings = servings,
            Products = products is null ? null : ToProfileProducts(products).ToArray(),
        }));

    [McpServerTool(Name = "create_planning_cycle", Title = "Create planning cycle", ReadOnly = false, Destructive = false, OpenWorld = false, UseStructuredContent = true)]
    [Description("Create a cycle with explicit inclusive dates and an optional complete initial plan. First show generated plans and exact dates for approval. Supply entries and notes together with planningVersion from the prior active read (none if no cycle). Creation and its initial plan are atomic. The new cycle becomes active. Omit entries/notes to create an empty cycle. Never adds groceries.")]
    public Task<McpCreatedPlanningCycleResponse> CreatePlanningCycle(
        [Description("Inclusive cycle start date.")] DateOnly startDate,
        [Description("Inclusive cycle end date.")] DateOnly endDate,
        [Description("Complete initial entries, in within-day order. New entries require unique client keys.")] PlanningEntryInputDto[]? entries = null,
        [Description("Complete initial day notes. New notes require unique client keys. Supply with entries, even when empty.")] PlanningNoteInputDto[]? notes = null,
        [Description("planningVersion from the prior active read. Required for a populated plan; use none when no cycle exists.")] string? expectedPlanningVersion = null) =>
        Execute(async () =>
        {
            var result = await planningReplacementCommands.Create(new CreateCyclePlanningDto
            {
                StartDate = startDate,
                EndDate = endDate,
                Entries = entries,
                Notes = notes,
                ExpectedPlanningVersion = expectedPlanningVersion,
            });
            var cycle = result.Cycle!;
            return new McpCreatedPlanningCycleResponse
            {
                Id = cycle.Id,
                StartDate = cycle.StartDate,
                EndDate = cycle.EndDate,
                PreviousPlanningCycleId = cycle.PreviousPlanningCycleId,
                NextPlanningCycleId = cycle.NextPlanningCycleId,
                Planning = result.Planning!,
                PlanningVersion = result.PlanningVersion,
                CreatedIds = result.CreatedIds,
            };
        });

    [McpServerTool(Name = "apply_planning", Title = "Apply agreed planning", ReadOnly = false, Destructive = true, OpenWorld = false, UseStructuredContent = true)]
    [Description("Atomically replace the active cycle's complete planning with an approved plan. Read current planning and supply its planningVersion. Include every retained meal, leftover and note; omitted records are removed and empty lists clear them. Preserve retained IDs; new records require unique client keys. Array order defines within-day order. Moves preserve grocery review; changed profiles clear it. Removed originals lose groceries/leftovers. Never adds groceries.")]
    public Task<PlanningStateDto> ApplyPlanning(
        [Description("Active cycle identifier returned by get_active_planning.")] Guid cycleId,
        [Description("Exact planningVersion returned when the proposed plan was read. A conflict requires a new read and reconciliation.")] string expectedPlanningVersion,
        [Description("Complete desired meals and linked leftovers, in within-day order. Omitted entries are removed.")] PlanningEntryInputDto[] entries,
        [Description("Complete desired notes. Omitted notes are removed; empty clears all notes.")] PlanningNoteInputDto[] notes) =>
        Execute(() => planningReplacementCommands.Apply(new ApplyPlanningDto
        {
            CycleId = cycleId,
            ExpectedPlanningVersion = expectedPlanningVersion,
            Entries = entries,
            Notes = notes,
        }));

    [McpServerTool(Name = "plan_meal", Title = "Plan meal", ReadOnly = false, Destructive = false, OpenWorld = false, UseStructuredContent = true)]
    [Description("Add a recipe and profile to an explicit date in the active planning cycle. This never adds groceries; grocery review is a separate deliberate action.")]
    public Task<PlanningEntryDto> PlanMeal(
        [Description("Recipe identifier.")] Guid recipeId,
        [Description("Profile identifier belonging to the recipe.")] Guid profileId,
        [Description("Date inside the active planning cycle.")] DateOnly date,
        [Description("Optional explicit active cycle identifier. Omit for the current active cycle; historical writes are rejected.")] Guid? cycleId = null) =>
        Execute(async () =>
        {
            var cycle = cycleId.HasValue ? await planningCycleQueries.GetPlanningCycle(cycleId.Value) : await planningCycleQueries.GetCurrentPlanningCycle();
            var planning = await planningQueries.GetCyclePlanning(cycle.Id);
            var command = new AddPlanningMealDto
            {
                PlanningId = planning.Id,
                RecipeId = recipeId,
                RecipeProfileId = profileId,
                Date = date,
            };
            await Validate(command);
            return await planningMealCommands.AddPlanningMeal(command);
        });

    [McpServerTool(Name = "review_meal_groceries", Title = "Review meal groceries", ReadOnly = false, Destructive = true, OpenWorld = false, UseStructuredContent = true)]
    [Description("Commit the complete grocery selection for one planned meal. This replaces a previous selection. An empty list explicitly records that there is nothing to buy. Do not call this merely because a meal was planned.")]
    public Task<PlanningMealGroceriesDto> ReviewMealGroceries(
        [Description("Original planned-meal identifier, not a leftover identifier.")] Guid planningMealId,
        [Description("Complete ordered purchase selection. May be empty.")] McpGroceryItemInput[] groceries) =>
        Execute(async () =>
        {
            var command = new AddMealGroceriesDto
            {
                Groceries = groceries.Select(item => new AddGroceryItemDto
                {
                    RecipeProfileProductId = item.RecipeProfileProductId,
                    Name = item.Name,
                    Quantity = item.Quantity,
                }).ToArray(),
            };
            await Validate(command);
            return await planningMealCommands.AddMealGroceries(planningMealId, command);
        });

    [McpServerTool(Name = "add_grocery_item", Title = "Add grocery item", ReadOnly = false, Destructive = false, OpenWorld = false, UseStructuredContent = true)]
    [Description("Add a manual grocery item. Supply planningMealId to add it to an already-reviewed meal group; otherwise omit it and optionally supply cycleId to add it to Other items.")]
    public Task<GroceryItemDto> AddGroceryItem(
        [Description("Grocery item name.")] string name,
        [Description("Whole purchase quantity, greater than zero.")] int quantity,
        [Description("Optional cycle identifier. Omit it to use the active cycle.")] Guid? cycleId = null,
        [Description("Optional planned-meal identifier for an already-reviewed meal group.")] Guid? planningMealId = null) =>
        Execute(async () =>
        {
            var command = new AddManualGroceryItemDto { Name = name, Quantity = quantity };
            await Validate(command);
            if (planningMealId.HasValue)
            {
                return await groceryListCommands.AddMealGroceryItem(planningMealId.Value, command);
            }

            var resolvedCycleId = cycleId ?? (await planningCycleQueries.GetCurrentPlanningCycle()).Id;
            return await groceryListCommands.AddManualGroceryItem(resolvedCycleId, command);
        });

    [McpServerTool(Name = "update_grocery_item", Title = "Update grocery item", ReadOnly = false, Destructive = true, Idempotent = true, OpenWorld = false, UseStructuredContent = true)]
    [Description("Replace a grocery item's name, whole purchase quantity, and collected state.")]
    public Task<GroceryItemDto> UpdateGroceryItem(
        [Description("Grocery item identifier returned by get_grocery_list.")] Guid groceryItemId,
        [Description("Replacement item name.")] string name,
        [Description("Replacement whole purchase quantity, greater than zero.")] int quantity,
        [Description("Whether the item has been collected.")] bool isChecked) =>
        Execute(async () =>
        {
            var command = new UpdateGroceryItemDto
            {
                Name = name,
                Quantity = quantity,
                Checked = isChecked,
            };
            await Validate(command);
            return await groceryListCommands.UpdateGroceryItem(groceryItemId, command);
        });

    [McpServerTool(Name = "remove_grocery_item", Title = "Remove grocery item", ReadOnly = false, Destructive = true, OpenWorld = false, UseStructuredContent = true)]
    [Description("Remove one shopping item from Other items or a meal group. Read get_grocery_list to resolve its ID and identify the group to the user; for a meal item, name its recipe and meal date. Clarify ambiguous matches. Removing an item preserves recipe/profile products and the meal's grocery-review status, even when its group becomes empty.")]
    public Task<McpRemovedGroceryResponse> RemoveGroceryItem(
        [Description("Grocery item identifier from groceries or a planningMealGroceries group in get_grocery_list.")] Guid groceryItemId) =>
        Execute(async () =>
        {
            await groceryListCommands.RemoveGroceryItem(groceryItemId);
            return new McpRemovedGroceryResponse { GroceryItemId = groceryItemId };
        });

    private static ICollection<RecipeProfileProductInputDto> ToProfileProducts(
        IEnumerable<McpProfileProductInput> products) =>
        products.Select(product => product is null || product.Id == Guid.Empty
            ? throw new ValidationException("Product rows cannot be null; omit IDs for new products.")
            : new RecipeProfileProductInputDto
            {
                Id = product.Id ?? Guid.Empty,
                Name = product.Name,
                Quantity = product.Quantity,
                AtHome = product.AtHome,
            }).ToArray();

    private async Task Validate<T>(T command)
    {
        var validator = services.GetRequiredService<IValidator<T>>();
        await validator.ValidateAndThrowAsync(command);
    }

    private static async Task<T> Execute<T>(Func<Task<T>> action)
    {
        try
        {
            return await action();
        }
        catch (ValidationException exception)
        {
            var errors = exception.Errors
                .GroupBy(error => error.PropertyName)
                .ToDictionary(group => group.Key, group => group.Select(error => error.ErrorMessage).ToArray());
            if (errors.Count == 0) errors.Add("input", [exception.Message]);
            throw new McpException(JsonSerializer.Serialize(new
            {
                code = ErrorCodes.ValidationError,
                message = "One or more inputs are invalid.",
                errors,
            }), exception);
        }
        catch (BaseError exception)
        {
            throw new McpException(JsonSerializer.Serialize(new
            {
                code = exception.ErrorCode,
                message = exception.Message,
                properties = exception.GetDetails(),
            }), exception);
        }
    }
}
