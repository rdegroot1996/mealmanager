using MealManager.Application.DTO.Mcp;
using System.Text.Json;
using MealManager.Application.Commands;
using MealManager.Application.DTO;
using MealManager.Application.Queries;
using MealManager.Common.Enums;
using MealManager.Domain.Entities;
using MealManager.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace MealManager.Tests.Integration.Tests;

public sealed partial class McpServerTests
{
    private static readonly DateOnly CycleStart = new(2026, 10, 6);

    [Fact]
    public async Task MealPlanReplacement_CreatesEmptyCycleAndReturnsItsVersion()
    {
        using var scope = Factory.Services.CreateScope();
        var result = await scope.ServiceProvider.GetRequiredService<MealPlanReplacementCommands>()
            .Create(new CreateCycleMealPlanDto { StartDate = CycleStart, EndDate = CycleStart.AddDays(6) });
        Assert.Equal(CycleStart, result.Cycle!.StartDate);
        Assert.Empty(result.MealPlan!.Entries);
        Assert.NotEqual(MealPlanStateQueries.EmptyVersion, result.MealPlanVersion);
    }

    [Fact]
    public async Task Mcp_CatalogPagesCoverMoreThanFiveHundredRecipesAndAllTags()
    {
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            for (var index = 0; index < 521; index++)
            {
                var id = Guid.CreateVersion7();
                db.Recipes.Add(new Recipe
                {
                    Id = id,
                    Name = $"Recipe {index:D3}",
                    Category = RecipeCategory.Meals,
                    BaseServings = 4,
                    Tags = [new RecipeTag { Id = Guid.CreateVersion7(), RecipeId = id, Name = $"Label {index % 61:D2}" }],
                    Ingredients = [new RecipeIngredient
                    {
                        Id = Guid.CreateVersion7(), RecipeId = id, Name = "Capsicum", Quantity = 1.25m, Unit = "pcs", Order = 0,
                    }],
                    Steps = [],
                    Profiles = [new RecipeProfile { Id = Guid.CreateVersion7(), RecipeId = id, Name = "Default", Servings = 4 }],
                });
            }
            await db.SaveChangesAsync();
            // Also exercise the Application query directly so SQL translation failures are actionable.
            var queries = scope.ServiceProvider.GetRequiredService<RecipeCatalogQueries>();
            var first = await queries.ListRecipes(new RecipeCatalogOptions());
            var second = await queries.ListRecipes(new RecipeCatalogOptions { Cursor = first.NextCursor });
            Assert.Equal(50, second.Recipes.Count);
        }
        using var client = CreateAuthenticatedClient();
        await Initialize(client);
        var recipeIds = new HashSet<Guid>();
        string? cursor = null;
        do
        {
            var page = await Tool(client, "list_recipe_catalog", new { cursor });
            Assert.Equal(521, page.GetProperty("totalCount").GetInt32());
            foreach (var recipe in page.GetProperty("recipes").EnumerateArray())
            {
                Assert.True(recipeIds.Add(recipe.GetProperty("id").GetGuid()));
                Assert.Equal(1.25m, recipe.GetProperty("ingredients")[0].GetProperty("quantity").GetDecimal());
                Assert.Equal("pcs", recipe.GetProperty("ingredients")[0].GetProperty("unit").GetString());
                Assert.NotEqual(Guid.Empty, recipe.GetProperty("profiles")[0].GetProperty("id").GetGuid());
                Assert.False(recipe.TryGetProperty("matchedIngredients", out _));
            }
            cursor = page.GetProperty("nextCursor").GetString();
        } while (cursor is not null);
        Assert.Equal(521, recipeIds.Count);

        var tags = new Dictionary<string, int>();
        do
        {
            var page = await Tool(client, "list_recipe_tags", new { cursor });
            Assert.Equal(61, page.GetProperty("totalCount").GetInt32());
            foreach (var tag in page.GetProperty("tags").EnumerateArray())
                tags.Add(tag.GetProperty("name").GetString()!, tag.GetProperty("recipeCount").GetInt32());
            cursor = page.GetProperty("nextCursor").GetString();
        } while (cursor is not null);
        Assert.Equal(521, tags.Values.Sum());
        var filtered = await Tool(client, "list_recipe_catalog", new { tags = new[] { "Label 60" } });
        Assert.Equal(tags["Label 60"], filtered.GetProperty("totalCount").GetInt32());
        var absent = await Tool(client, "list_recipe_catalog", new { tags = new[] { "Absent" } });
        Assert.Empty(absent.GetProperty("recipes").EnumerateArray());
    }

    [Fact]
    public async Task Mcp_LabelNamesRemainExactAndCountDistinctRecipes()
    {
        using var client = CreateAuthenticatedClient();
        await Initialize(client);
        var recipe = await CreateTestRecipe(client);
        var recipeId = recipe.GetProperty("id").GetGuid();
        await Tool(client, "update_recipe", new { recipeId, tags = new[] { "Easy", "easy", " Easy ", "Easy" } });
        var tags = await Tool(client, "list_recipe_tags", new { });
        Assert.Equal(3, tags.GetProperty("totalCount").GetInt32());
        foreach (var tag in tags.GetProperty("tags").EnumerateArray())
        {
            Assert.Equal(1, tag.GetProperty("recipeCount").GetInt32());
            var exact = await Tool(client, "list_recipe_catalog", new { tags = new[] { tag.GetProperty("name").GetString() } });
            Assert.Equal(recipeId, Assert.Single(exact.GetProperty("recipes").EnumerateArray()).GetProperty("id").GetGuid());
        }
        var absent = await Tool(client, "list_recipe_catalog", new { tags = new[] { "EASY" } });
        Assert.Empty(absent.GetProperty("recipes").EnumerateArray());
        await ToolError(client, "list_recipe_catalog", new { tags = new[] { " " } }, "ValidationError");
    }

    [Fact]
    public async Task Mcp_CatalogRejectsInvalidAndCrossFilterCursors()
    {
        using var client = CreateAuthenticatedClient();
        await Initialize(client);
        await CreateTestRecipe(client);
        await CreateTestRecipe(client);
        var page = await Tool(client, "list_recipe_catalog", new { pageSize = 1 });
        await ToolError(client, "list_recipe_catalog", new { cursor = page.GetProperty("nextCursor").GetString(), favorite = true }, "ValidationError");
        await ToolError(client, "list_recipe_tags", new { cursor = page.GetProperty("nextCursor").GetString() }, "ValidationError");
        await ToolError(client, "list_recipe_catalog", new { cursor = "invalid" }, "ValidationError");
        await ToolError(client, "list_recipe_catalog", new { pageSize = 0 }, "ValidationError");
        await ToolError(client, "list_recipe_tags", new { pageSize = 51 }, "ValidationError");
    }

    [Fact]
    public async Task Mcp_RecipePatchPreservesIdsAndConfirmedDefaultGroceries()
    {
        using var client = CreateAuthenticatedClient();
        await Initialize(client);
        var recipe = await CreateTestRecipe(client);
        var recipeId = recipe.GetProperty("id").GetGuid();
        var profileId = recipe.GetProperty("profiles")[0].GetProperty("id").GetGuid();
        await ToolError(client, "update_recipe_profile", new
        {
            profileId,
            groceries = new[] { new { name = "Invalid pack count", quantity = 0, atHome = false } },
        }, "ValidationError");
        var incomplete = await Tool(client, "get_recipe_profile", new { profileId });
        Assert.Empty(incomplete.GetProperty("groceries").EnumerateArray());
        var existingRecipe = await Tool(client, "get_recipe", new { recipeId });
        Assert.Single(existingRecipe.GetProperty("profiles").EnumerateArray());
        await Tool(client, "update_recipe_profile", new
        {
            profileId,
            groceries = new[]
            {
                new { name = "Bell peppers pack", quantity = 1, atHome = false },
                new { name = "Salt", quantity = 1, atHome = true },
            },
        });
        await Tool(client, "set_recipe_favorite", new { recipeId, isFavorite = true });
        var retainedId = recipe.GetProperty("ingredients")[0].GetProperty("id").GetGuid();
        var retainedStep = recipe.GetProperty("steps")[0].GetProperty("id").GetGuid();
        var updated = await Tool(client, "update_recipe", new
        {
            recipeId,
            name = "Edited recipe",
            baseServings = 8,
            ingredients = new object[]
            {
                new { name = "Carrots", quantity = 1.5m, unit = "kg" },
                new { id = retainedId, name = "Capsicum", quantity = 2.25m, unit = "pcs" },
            },
            steps = new object[] { new { id = retainedStep, description = "Cook twice as much." }, new { description = "Cool extra portions." } },
        });
        Assert.True(updated.GetProperty("isFavorite").GetBoolean());
        Assert.Equal(retainedId, updated.GetProperty("ingredients")[1].GetProperty("id").GetGuid());
        Assert.Equal(2.25m, updated.GetProperty("ingredients")[1].GetProperty("quantity").GetDecimal());
        Assert.Equal(retainedStep, updated.GetProperty("steps")[0].GetProperty("id").GetGuid());
        Assert.Single(updated.GetProperty("profiles").EnumerateArray());
        Assert.Equal(profileId, updated.GetProperty("profiles")[0].GetProperty("id").GetGuid());
        Assert.Equal(4, updated.GetProperty("profiles")[0].GetProperty("servings").GetInt32());
        var profile = await Tool(client, "get_recipe_profile", new { profileId });
        Assert.Equal(2, profile.GetProperty("groceries").GetArrayLength());
        Assert.False(profile.GetProperty("groceries")[0].GetProperty("atHome").GetBoolean());
        Assert.True(profile.GetProperty("groceries")[1].GetProperty("atHome").GetBoolean());
        await ToolError(client, "update_recipe", new { recipeId }, "ValidationError");
        await ToolError(client, "update_recipe", new { recipeId, baseServings = 0 }, "ValidationError");
        await ToolError(client, "update_recipe", new { recipeId, steps = new[] { new { id = Guid.NewGuid(), description = "Foreign" } } }, "ValidationError");
        var duplicate = new { id = retainedId, name = "Capsicum", quantity = 1m, unit = "pcs" };
        await ToolError(client, "update_recipe", new { recipeId, ingredients = new[] { duplicate, duplicate } }, "ValidationError");
        var afterFailure = await Tool(client, "get_recipe", new { recipeId });
        Assert.Equal("Edited recipe", afterFailure.GetProperty("name").GetString());
        var cleared = await Tool(client, "update_recipe", new { recipeId, ingredients = Array.Empty<object>(), steps = Array.Empty<object>(), tags = Array.Empty<string>() });
        Assert.Empty(cleared.GetProperty("ingredients").EnumerateArray());
        Assert.Empty(cleared.GetProperty("steps").EnumerateArray());
        Assert.Empty(cleared.GetProperty("tags").EnumerateArray());
    }

    [Fact]
    public async Task Mcp_InitialPlanIncludesEatingOutCookingAheadAndBulkProfile()
    {
        using var client = CreateAuthenticatedClient();
        await Initialize(client);
        var recipe = await CreateTestRecipe(client);
        var recipeId = recipe.GetProperty("id").GetGuid();
        var bulk = await Tool(client, "create_recipe_profile", new { recipeId, name = "Bulk", servings = 12 });
        var bulkId = bulk.GetProperty("id").GetGuid();
        var empty = await Tool(client, "get_active_meal_plan", new { });
        Assert.Equal("none", empty.GetProperty("mealPlanVersion").GetString());
        var created = await Tool(client, "create_planning_cycle", new
        {
            startDate = CycleStart,
            endDate = CycleStart.AddDays(6),
            expectedMealPlanVersion = "none",
            entries = new[]
            {
                Meal("thursday", CycleStart.AddDays(2), recipeId, bulkId),
                Leftover("friday", CycleStart.AddDays(3), originalKey: "thursday"),
                Meal("saturday", CycleStart.AddDays(4), recipeId, bulkId),
            },
            notes = new[]
            {
                Note("eat-out", CycleStart.AddDays(1), "Eating out"),
                Note("freezer", CycleStart.AddDays(4), "Meals and 8 extra portions for the freezer"),
            },
        });
        Assert.Equal(CycleStart, created.GetProperty("startDate").Deserialize<DateOnly>());
        Assert.Equal(CycleStart.AddDays(6), created.GetProperty("endDate").Deserialize<DateOnly>());
        var mealPlan = created.GetProperty("mealPlan");
        Assert.Equal(3, mealPlan.GetProperty("entries").GetArrayLength());
        Assert.Equal("Leftover", mealPlan.GetProperty("entries")[1].GetProperty("kind").GetString());
        Assert.Equal(mealPlan.GetProperty("entries")[0].GetProperty("id").GetGuid(),
            mealPlan.GetProperty("entries")[1].GetProperty("originalMealId").GetGuid());
        Assert.Equal(12, mealPlan.GetProperty("entries")[2].GetProperty("recipeProfile").GetProperty("servings").GetInt32());
        Assert.Equal(5, created.GetProperty("createdIds").EnumerateObject().Count());
        Assert.All(mealPlan.GetProperty("entries").EnumerateArray(), entry => Assert.False(entry.GetProperty("hasReviewedGroceries").GetBoolean()));
        var groceries = await Tool(client, "get_shopping_list", new { });
        Assert.Empty(groceries.GetProperty("items").EnumerateArray());
        Assert.Empty(groceries.GetProperty("mealGroups").EnumerateArray());
        var reread = await Tool(client, "get_active_meal_plan", new { });
        Assert.Equal(created.GetProperty("mealPlanVersion").GetString(), reread.GetProperty("mealPlanVersion").GetString());
    }

    [Fact]
    public async Task Mcp_CorrectsPlanningAndPreservesOnlyUnchangedMealGroceries()
    {
        using var client = CreateAuthenticatedClient();
        await Initialize(client);
        var recipe = await CreateTestRecipe(client);
        var recipeId = recipe.GetProperty("id").GetGuid();
        var profileId = recipe.GetProperty("profiles")[0].GetProperty("id").GetGuid();
        var bulk = await Tool(client, "create_recipe_profile", new { recipeId, name = "Bulk", servings = 8 });
        var bulkId = bulk.GetProperty("id").GetGuid();
        var cycle = await Tool(client, "create_planning_cycle", new
        {
            startDate = CycleStart,
            endDate = CycleStart.AddDays(6),
            expectedMealPlanVersion = "none",
            entries = new[]
            {
                Meal("one", CycleStart, recipeId, profileId),
                Meal("two", CycleStart.AddDays(1), recipeId, profileId),
                Meal("three", CycleStart.AddDays(4), recipeId, profileId),
                Leftover("first-leftover", CycleStart.AddDays(2), originalKey: "one"),
                Leftover("second-leftover", CycleStart.AddDays(3), originalKey: "one"),
                Leftover("removed-leftover", CycleStart.AddDays(5), originalKey: "three"),
            },
            notes = new[] { Note("note", CycleStart.AddDays(1), "Old context") },
        });
        var ids = cycle.GetProperty("createdIds");
        var one = ids.GetProperty("one").GetGuid();
        var two = ids.GetProperty("two").GetGuid();
        var three = ids.GetProperty("three").GetGuid();
        var firstLeftover = ids.GetProperty("first-leftover").GetGuid();
        var secondLeftover = ids.GetProperty("second-leftover").GetGuid();
        var noteId = ids.GetProperty("note").GetGuid();
        var reviewed = await Tool(client, "review_meal_groceries", new { plannedMealId = one, groceries = new[] { new { name = "Peppers", quantity = 1 } } });
        var groceryId = reviewed.GetProperty("items")[0].GetProperty("id").GetGuid();
        await Tool(client, "review_meal_groceries", new { plannedMealId = two, groceries = Array.Empty<object>() });
        await Tool(client, "review_meal_groceries", new { plannedMealId = three, groceries = new[] { new { name = "Discarded", quantity = 1 } } });
        await Tool(client, "add_shopping_list_item", new { name = "Manual milk", quantity = 1 });
        var current = await Tool(client, "get_active_meal_plan", new { });
        var changed = await Tool(client, "apply_meal_plan", new
        {
            cycleId = cycle.GetProperty("id").GetGuid(),
            expectedMealPlanVersion = current.GetProperty("mealPlanVersion").GetString(),
            entries = new[]
            {
                Meal(null, CycleStart.AddDays(1), recipeId, bulkId, two),
                Meal(null, CycleStart.AddDays(1), recipeId, profileId, one),
                Leftover(null, CycleStart.AddDays(3), originalId: one, id: firstLeftover),
                Leftover(null, CycleStart.AddDays(2), originalId: one, id: secondLeftover),
            },
            notes = new[] { Note(null, CycleStart.AddDays(2), "Updated context", noteId), Note("out", CycleStart.AddDays(4), "Eating out") },
        });
        var entries = changed.GetProperty("mealPlan").GetProperty("entries");
        Assert.Equal(4, entries.GetArrayLength());
        Assert.Equal(two, entries[0].GetProperty("id").GetGuid());
        Assert.False(entries[0].GetProperty("hasReviewedGroceries").GetBoolean());
        Assert.Equal(one, entries[1].GetProperty("id").GetGuid());
        Assert.True(entries[1].GetProperty("hasReviewedGroceries").GetBoolean());
        Assert.Equal(1, entries[1].GetProperty("sortOrder").GetInt32());
        Assert.Equal(secondLeftover, entries[2].GetProperty("id").GetGuid());
        Assert.Equal(firstLeftover, entries[3].GetProperty("id").GetGuid());
        var groceries = await Tool(client, "get_shopping_list", new { });
        var group = Assert.Single(groceries.GetProperty("mealGroups").EnumerateArray());
        Assert.Equal(groceryId, Assert.Single(group.GetProperty("items").EnumerateArray()).GetProperty("id").GetGuid());
        Assert.Equal("Manual milk", Assert.Single(groceries.GetProperty("items").EnumerateArray()).GetProperty("name").GetString());
        var reread = await Tool(client, "get_active_meal_plan", new { });
        Assert.Equal(changed.GetProperty("mealPlanVersion").GetString(), reread.GetProperty("mealPlanVersion").GetString());
        var cleared = await Tool(client, "apply_meal_plan", new
        {
            cycleId = cycle.GetProperty("id").GetGuid(),
            expectedMealPlanVersion = reread.GetProperty("mealPlanVersion").GetString(),
            entries = Array.Empty<object>(),
            notes = Array.Empty<object>(),
        });
        Assert.Empty(cleared.GetProperty("mealPlan").GetProperty("entries").EnumerateArray());
        Assert.Empty(cleared.GetProperty("mealPlan").GetProperty("notes").EnumerateArray());
        groceries = await Tool(client, "get_shopping_list", new { });
        Assert.Empty(groceries.GetProperty("mealGroups").EnumerateArray());
        Assert.Single(groceries.GetProperty("items").EnumerateArray());
    }

    [Fact]
    public async Task Mcp_RejectsStalePlansAfterShoppingProfileAndCycleChanges()
    {
        using var client = CreateAuthenticatedClient();
        await Initialize(client);
        var recipe = await CreateTestRecipe(client);
        var recipeId = recipe.GetProperty("id").GetGuid();
        var profileId = recipe.GetProperty("profiles")[0].GetProperty("id").GetGuid();
        var cycle = await Tool(client, "create_planning_cycle", new
        {
            startDate = CycleStart,
            endDate = CycleStart.AddDays(6),
            expectedMealPlanVersion = "none",
            entries = new[] { Meal("meal", CycleStart, recipeId, profileId) },
            notes = Array.Empty<object>(),
        });
        var cycleId = cycle.GetProperty("id").GetGuid();
        var mealId = cycle.GetProperty("createdIds").GetProperty("meal").GetGuid();
        var review = await Tool(client, "review_meal_groceries", new { plannedMealId = mealId, groceries = new[] { new { name = "Peppers", quantity = 1 } } });
        var beforeShopping = await Tool(client, "get_active_meal_plan", new { });
        var shoppingListItemId = review.GetProperty("items")[0].GetProperty("id").GetGuid();
        await Tool(client, "update_shopping_list_item", new { shoppingListItemId, name = "Peppers", quantity = 2, isChecked = true });
        await ToolError(client, "apply_meal_plan", new
        {
            cycleId,
            expectedMealPlanVersion = beforeShopping.GetProperty("mealPlanVersion").GetString(),
            entries = Array.Empty<object>(),
            notes = Array.Empty<object>(),
        }, "MealPlanChanged");
        var beforeProfile = await Tool(client, "get_active_meal_plan", new { });
        await Tool(client, "update_recipe_profile", new { profileId, servings = 8 });
        await ToolError(client, "apply_meal_plan", new
        {
            cycleId,
            expectedMealPlanVersion = beforeProfile.GetProperty("mealPlanVersion").GetString(),
            entries = Array.Empty<object>(),
            notes = Array.Empty<object>(),
        }, "MealPlanChanged");
        var beforeCycle = await Tool(client, "get_active_meal_plan", new { });
        var next = await Tool(client, "create_planning_cycle", new
        {
            startDate = CycleStart.AddDays(7),
            endDate = CycleStart.AddDays(13),
            expectedMealPlanVersion = beforeCycle.GetProperty("mealPlanVersion").GetString(),
            entries = new[] { Meal("next", CycleStart.AddDays(7), recipeId, profileId) },
            notes = Array.Empty<object>(),
        });
        await ToolError(client, "apply_meal_plan", new
        {
            cycleId,
            expectedMealPlanVersion = beforeCycle.GetProperty("mealPlanVersion").GetString(),
            entries = Array.Empty<object>(),
            notes = Array.Empty<object>(),
        }, "HistoricalCycleReadOnly");
        await ToolError(client, "plan_meal", new { cycleId, recipeId, profileId, date = CycleStart }, "HistoricalCycleReadOnly");
        await ToolError(client, "create_planning_cycle", new
        {
            startDate = CycleStart.AddDays(14),
            endDate = CycleStart.AddDays(20),
            expectedMealPlanVersion = beforeCycle.GetProperty("mealPlanVersion").GetString(),
            entries = Array.Empty<object>(),
            notes = Array.Empty<object>(),
        }, "MealPlanChanged");
        var current = await Tool(client, "get_active_meal_plan", new { });
        Assert.Equal(next.GetProperty("id").GetGuid(), current.GetProperty("cycle").GetProperty("id").GetGuid());
        Assert.Single(current.GetProperty("mealPlan").GetProperty("entries").EnumerateArray());
    }

    [Fact]
    public async Task Mcp_InvalidNewPlanDoesNotCreateCycleOrChangeActiveCycle()
    {
        using var client = CreateAuthenticatedClient();
        await Initialize(client);
        var recipe = await CreateTestRecipe(client);
        var recipeId = recipe.GetProperty("id").GetGuid();
        var profileId = recipe.GetProperty("profiles")[0].GetProperty("id").GetGuid();
        await ToolError(client, "create_planning_cycle", new
        {
            startDate = CycleStart,
            endDate = CycleStart.AddDays(6),
            expectedMealPlanVersion = "none",
            entries = new[] { Meal("invalid", CycleStart.AddDays(7), recipeId, profileId) },
            notes = Array.Empty<object>(),
        }, "DateOutsideCycle");
        var state = await Tool(client, "get_active_meal_plan", new { });
        Assert.Equal(JsonValueKind.Null, state.GetProperty("cycle").ValueKind);
        await ToolError(client, "create_planning_cycle", new
        {
            startDate = CycleStart,
            endDate = CycleStart.AddDays(6),
            entries = Array.Empty<object>(),
            notes = Array.Empty<object>(),
        }, "ValidationError");
        var existing = await Tool(client, "create_planning_cycle", new { startDate = CycleStart, endDate = CycleStart.AddDays(6) });
        var version = existing.GetProperty("mealPlanVersion").GetString();
        await ToolError(client, "create_planning_cycle", new
        {
            startDate = CycleStart.AddDays(7),
            endDate = CycleStart.AddDays(13),
            expectedMealPlanVersion = version,
            entries = new[] { Meal("wrong-profile", CycleStart.AddDays(7), recipeId, Guid.NewGuid()) },
            notes = Array.Empty<object>(),
        }, "InvalidMealPlan");
        state = await Tool(client, "get_active_meal_plan", new { });
        Assert.Equal(existing.GetProperty("id").GetGuid(), state.GetProperty("cycle").GetProperty("id").GetGuid());
        Assert.Equal(version, state.GetProperty("mealPlanVersion").GetString());
    }

    [Theory]
    [InlineData("duplicate-key", "InvalidMealPlan")]
    [InlineData("foreign-entry", "InvalidMealPlan")]
    [InlineData("broken-leftover", "InvalidMealPlan")]
    [InlineData("early-leftover", "LeftoverMustFollowOriginal")]
    [InlineData("duplicate-leftover", "InvalidMealPlan")]
    [InlineData("duplicate-note", "InvalidMealPlan")]
    [InlineData("empty-note", "ValidationError")]
    public async Task Mcp_InvalidCorrectionLeavesWholePlanningUnchanged(string scenario, string code)
    {
        using var client = CreateAuthenticatedClient();
        await Initialize(client);
        var recipe = await CreateTestRecipe(client);
        var recipeId = recipe.GetProperty("id").GetGuid();
        var profileId = recipe.GetProperty("profiles")[0].GetProperty("id").GetGuid();
        var cycle = await Tool(client, "create_planning_cycle", new
        {
            startDate = CycleStart,
            endDate = CycleStart.AddDays(6),
            expectedMealPlanVersion = "none",
            entries = new[] { Meal("old", CycleStart, recipeId, profileId) },
            notes = new[] { Note("old-note", CycleStart, "Keep this") },
        });
        var mealId = cycle.GetProperty("createdIds").GetProperty("old").GetGuid();
        var entries = new List<PlannedEntryInputDto> { Meal(null, CycleStart, recipeId, profileId, mealId) };
        var notes = new List<PlanningDayNoteInputDto>();
        switch (scenario)
        {
            case "duplicate-key": entries.Add(Meal("same", CycleStart, recipeId, profileId)); entries.Add(Meal("same", CycleStart, recipeId, profileId)); break;
            case "foreign-entry": entries.Add(Meal(null, CycleStart, recipeId, profileId, Guid.NewGuid())); break;
            case "broken-leftover": entries.Add(Leftover("broken", CycleStart.AddDays(1), originalKey: "absent")); break;
            case "early-leftover": entries.Add(Leftover("early", CycleStart, originalId: mealId)); break;
            case "duplicate-leftover": entries.Add(Leftover("a", CycleStart.AddDays(1), originalId: mealId)); entries.Add(Leftover("b", CycleStart.AddDays(1), originalId: mealId)); break;
            case "duplicate-note": notes.Add(Note("a", CycleStart, "First")); notes.Add(Note("b", CycleStart, "Second")); break;
            case "empty-note": notes.Add(Note("empty", CycleStart, "")); break;
        }
        await ToolError(client, "apply_meal_plan", new
        {
            cycleId = cycle.GetProperty("id").GetGuid(),
            expectedMealPlanVersion = cycle.GetProperty("mealPlanVersion").GetString(),
            entries,
            notes,
        }, code);
        var current = await Tool(client, "get_active_meal_plan", new { });
        Assert.Equal(cycle.GetProperty("mealPlanVersion").GetString(), current.GetProperty("mealPlanVersion").GetString());
        Assert.Single(current.GetProperty("mealPlan").GetProperty("entries").EnumerateArray());
        Assert.Equal("Keep this", Assert.Single(current.GetProperty("mealPlan").GetProperty("notes").EnumerateArray()).GetProperty("text").GetString());
    }

    [Fact]
    public async Task Mcp_RecipeAndProfilePatchesRejectStaleVersionsAndInvalidGroceryItemIds()
    {
        using var client = CreateAuthenticatedClient();
        await Initialize(client);
        var recipe = await CreateTestRecipe(client);
        var recipeId = recipe.GetProperty("id").GetGuid();
        var profileId = recipe.GetProperty("profiles")[0].GetProperty("id").GetGuid();
        var beforeRecipe = await Tool(client, "get_recipe", new { recipeId });
        Assert.Equal(recipe.GetProperty("recipeVersion").GetString(), beforeRecipe.GetProperty("recipeVersion").GetString());
        await Tool(client, "update_recipe", new { recipeId, name = "Web edit wins" });
        await ToolError(client, "update_recipe", new { recipeId, expectedRecipeVersion = beforeRecipe.GetProperty("recipeVersion").GetString(), name = "Stale AI proposal" }, "RecipeChanged");
        Assert.Equal("Web edit wins", (await Tool(client, "get_recipe", new { recipeId })).GetProperty("name").GetString());

        var beforeProfile = await Tool(client, "get_recipe_profile", new { profileId });
        var editedProfile = await Tool(client, "update_recipe_profile", new { profileId, groceries = new[] { new { name = "Peppers", quantity = 1 } } });
        await ToolError(client, "update_recipe_profile", new { profileId, expectedProfileVersion = beforeProfile.GetProperty("profileVersion").GetString(), groceries = Array.Empty<object>() }, "RecipeChanged");
        var productId = editedProfile.GetProperty("groceries")[0].GetProperty("id").GetGuid();
        var duplicate = new { id = productId, name = "Peppers", quantity = 1 };
        await ToolError(client, "update_recipe_profile", new { profileId, groceries = new[] { duplicate, duplicate } }, "ValidationError");
        await ToolError(client, "update_recipe_profile", new { profileId, groceries = new[] { new { id = Guid.NewGuid(), name = "Foreign grocery", quantity = 1 } } }, "ValidationError");
        await ToolError(client, "update_recipe_profile", new { profileId }, "ValidationError");
        Assert.Equal(editedProfile.GetProperty("profileVersion").GetString(), (await Tool(client, "get_recipe_profile", new { profileId })).GetProperty("profileVersion").GetString());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Mcp_ShoppingIdentifiesMealItemsAndAllowsRemoval(bool historical)
    {
        using var client = CreateAuthenticatedClient();
        await Initialize(client);
        var recipe = await CreateTestRecipe(client);
        var recipeId = recipe.GetProperty("id").GetGuid();
        var profileId = recipe.GetProperty("profiles")[0].GetProperty("id").GetGuid();
        var profile = await Tool(client, "update_recipe_profile", new { profileId, groceries = new[] { new { name = "Peppers", quantity = 1 } } });
        var productId = profile.GetProperty("groceries")[0].GetProperty("id").GetGuid();
        var cycle = await Tool(client, "create_planning_cycle", new { startDate = CycleStart, endDate = CycleStart.AddDays(6) });
        var cycleId = cycle.GetProperty("id").GetGuid();
        var meal = await Tool(client, "plan_meal", new { recipeId, profileId, date = CycleStart });
        var mealId = meal.GetProperty("id").GetGuid();
        var otherMeal = await Tool(client, "plan_meal", new { recipeId, profileId, date = CycleStart.AddDays(1) });
        var otherMealId = otherMeal.GetProperty("id").GetGuid();
        var selection = await Tool(client, "review_meal_groceries", new { plannedMealId = mealId, groceries = new[] { new { recipeProfileGroceryItemId = productId, name = "Peppers", quantity = 1 } } });
        var mealItemId = selection.GetProperty("items")[0].GetProperty("id").GetGuid();
        var otherSelection = await Tool(client, "review_meal_groceries", new { plannedMealId = otherMealId, groceries = new[] { new { recipeProfileGroceryItemId = productId, name = "Peppers", quantity = 1 } } });
        var otherItemId = otherSelection.GetProperty("items")[0].GetProperty("id").GetGuid();
        var manual = await Tool(client, "add_shopping_list_item", new { name = "Peppers", quantity = 2 });
        var manualId = manual.GetProperty("id").GetGuid();
        if (historical)
            await Tool(client, "create_planning_cycle", new { startDate = CycleStart.AddDays(7), endDate = CycleStart.AddDays(13) });

        var before = await Tool(client, "get_shopping_list", new { cycleId });
        Assert.Equal(JsonValueKind.Null, Assert.Single(before.GetProperty("items").EnumerateArray()).GetProperty("plannedMealId").ValueKind);
        var groups = before.GetProperty("mealGroups").EnumerateArray().ToArray();
        Assert.Equal(2, groups.Length);
        foreach (var group in groups)
        {
            var summary = group.GetProperty("meal");
            Assert.Equal(recipeId, summary.GetProperty("recipeId").GetGuid());
            Assert.Equal("Vegetable mince", summary.GetProperty("recipeName").GetString());
            Assert.Equal("Default", summary.GetProperty("profileName").GetString());
            Assert.Equal(4, summary.GetProperty("profileServings").GetInt32());
            var originalId = summary.GetProperty("id").GetGuid();
            Assert.Equal(originalId == mealId ? CycleStart : CycleStart.AddDays(1), summary.GetProperty("date").Deserialize<DateOnly>());
            Assert.Equal(originalId, Assert.Single(group.GetProperty("items").EnumerateArray()).GetProperty("plannedMealId").GetGuid());
        }

        await Tool(client, "remove_shopping_list_item", new { shoppingListItemId = manualId });
        await Tool(client, "remove_shopping_list_item", new { shoppingListItemId = mealItemId });
        var after = await Tool(client, "get_shopping_list", new { cycleId });
        Assert.Empty(after.GetProperty("items").EnumerateArray());
        var afterGroups = after.GetProperty("mealGroups").EnumerateArray().ToArray();
        Assert.Equal(2, afterGroups.Length);
        Assert.Empty(afterGroups.Single(group => group.GetProperty("meal").GetProperty("id").GetGuid() == mealId).GetProperty("items").EnumerateArray());
        var retainedGroup = afterGroups.Single(group => group.GetProperty("meal").GetProperty("id").GetGuid() == otherMealId);
        Assert.Equal(otherItemId, Assert.Single(retainedGroup.GetProperty("items").EnumerateArray()).GetProperty("id").GetGuid());
        Assert.Equal(profile.GetProperty("profileVersion").GetString(), (await Tool(client, "get_recipe_profile", new { profileId })).GetProperty("profileVersion").GetString());
        Assert.Equal(recipe.GetProperty("recipeVersion").GetString(), (await Tool(client, "get_recipe", new { recipeId })).GetProperty("recipeVersion").GetString());
        if (!historical)
        {
            var mealPlan = await Tool(client, "get_active_meal_plan", new { });
            Assert.All(mealPlan.GetProperty("mealPlan").GetProperty("entries").EnumerateArray(), entry => Assert.True(entry.GetProperty("hasReviewedGroceries").GetBoolean()));
        }
    }

    [Fact]
    public async Task Mcp_SearchSharesWebFilteringSortingAndLimit()
    {
        using var client = CreateAuthenticatedClient();
        await Initialize(client);
        var first = await CreateTestRecipe(client);
        var second = await CreateTestRecipe(client);
        await Tool(client, "update_recipe", new { recipeId = first.GetProperty("id").GetGuid(), name = "Zucchini" });
        await Tool(client, "update_recipe", new { recipeId = second.GetProperty("id").GetGuid(), name = "Carrots" });
        foreach (var sort in new[] { "Name", "LeastPlanned", "LeastRecentlyPlanned", "RecentPlanningPopularity" })
        {
            var mcp = await Tool(client, "search_recipes", new { tags = new[] { "Easy", "Freezable" }, category = "Meals", sort, limit = 1 });
            using var web = await HttpClient.GetAsync($"/api/recipes?tags=Easy&tags=Freezable&category=Meals&sort={sort}");
            web.EnsureSuccessStatusCode();
            using var response = JsonDocument.Parse(await web.Content.ReadAsStringAsync());
            Assert.Equal(response.RootElement[0].GetProperty("id").GetGuid(), Assert.Single(mcp.GetProperty("recipes").EnumerateArray()).GetProperty("id").GetGuid());
        }
    }

    private async Task<JsonElement> Tool(HttpClient client, string name, object arguments)
    {
        using var response = await CallTool(client, name, arguments);
        return response.RootElement.GetProperty("result").GetProperty("structuredContent").Clone();
    }

    private async Task ToolError(HttpClient client, string name, object arguments, string code)
    {
        arguments = await WithEditVersion(client, name, arguments);
        using var response = await SendRequest(client, "tools/call", new { name, arguments });
        var result = response.RootElement.GetProperty("result");
        Assert.True(result.GetProperty("isError").GetBoolean());
        Assert.Contains(code, result.GetProperty("content")[0].GetProperty("text").GetString());
    }

    private Task<JsonElement> CreateTestRecipe(HttpClient client) => Tool(client, "create_recipe", new
    {
        name = "Vegetable mince",
        category = "Meals",
        baseServings = 4,
        tags = new[] { "Easy", "Freezable" },
        ingredients = new[]
        {
            new { name = "Bell pepper", quantity = 2m, unit = "pcs" },
            new { name = "Ground meat", quantity = 0.5m, unit = "kg" },
        },
        steps = new[] { "Cook the ingredients." },
    });

    private static PlannedEntryInputDto Meal(string? key, DateOnly date, Guid recipeId, Guid profileId, Guid? id = null) =>
        new() { ClientKey = key, Id = id, Kind = PlannedEntryKind.Meal, Date = date, RecipeId = recipeId, ProfileId = profileId };

    private static PlannedEntryInputDto Leftover(string? key, DateOnly date, Guid? originalId = null, string? originalKey = null, Guid? id = null) =>
        new() { ClientKey = key, Id = id, Kind = PlannedEntryKind.Leftover, Date = date, OriginalMealId = originalId, OriginalMealKey = originalKey };

    private static PlanningDayNoteInputDto Note(string? key, DateOnly date, string text, Guid? id = null) =>
        new() { ClientKey = key, Id = id, Date = date, Text = text };
}
