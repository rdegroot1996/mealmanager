using System.Text.Json;
using Xunit;

namespace MealManager.Tests.Integration.Tests;

public sealed partial class McpServerTests
{
    [Fact]
    public async Task Mcp_NotesArePreservedClearedAndVersionProtected()
    {
        using var client = CreateAuthenticatedClient();
        var initialization = await Initialize(client);
        Assert.Contains("proactively discover household context", initialization.RootElement.GetProperty("result").GetProperty("instructions").GetString());
        var recipe = await Tool(client, "create_recipe", new
        {
            name = "Bread",
            category = "Baking",
            baseServings = 4,
            tags = Array.Empty<string>(),
            ingredients = Array.Empty<object>(),
            steps = Array.Empty<string>(),
            notes = "Book, page 10\nFamily favorite",
        });
        var id = recipe.GetProperty("id").GetGuid();
        var version = recipe.GetProperty("recipeVersion").GetString();
        var changed = await Tool(client, "update_recipe", new { recipeId = id, expectedRecipeVersion = version, notes = "Revised notes" });
        Assert.NotEqual(version, changed.GetProperty("recipeVersion").GetString());
        await ToolError(client, "update_recipe", new { recipeId = id, expectedRecipeVersion = version, notes = "Stale" }, "RecipeChanged");
        var renamed = await Tool(client, "update_recipe", new { recipeId = id, expectedRecipeVersion = changed.GetProperty("recipeVersion").GetString(), name = "Family bread" });
        Assert.Equal("Revised notes", renamed.GetProperty("notes").GetString());
        var cleared = await Tool(client, "update_recipe", new { recipeId = id, expectedRecipeVersion = renamed.GetProperty("recipeVersion").GetString(), notes = "" });
        Assert.Equal("", cleared.GetProperty("notes").GetString());
        await ToolError(client, "create_recipe", new { name = "Long notes", category = "Baking", baseServings = 2, tags = Array.Empty<string>(), ingredients = Array.Empty<object>(), steps = Array.Empty<string>(), notes = new string('x', 4001) }, "ValidationError");
    }

    [Fact]
    public async Task Mcp_FrequencyCountsFutureOriginalsWhileRecencyExcludesThem()
    {
        using var client = CreateAuthenticatedClient();
        await Initialize(client);
        var past = await CreateTestRecipe(client);
        var future = await CreateTestRecipe(client);
        var never = await CreateTestRecipe(client);
        var today = DateOnly.FromDateTime(DateTime.Today);
        var pastId = past.GetProperty("id").GetGuid();
        var futureId = future.GetProperty("id").GetGuid();
        await Tool(client, "create_planning_cycle", new
        {
            startDate = today.AddDays(-1),
            endDate = today.AddDays(3),
            expectedPlanningVersion = "none",
            entries = new[]
            {
                Meal("past", today.AddDays(-1), pastId, past.GetProperty("profiles")[0].GetProperty("id").GetGuid()),
                Meal("today", today, pastId, past.GetProperty("profiles")[0].GetProperty("id").GetGuid()),
                Leftover("leftover", today.AddDays(1), originalKey: "today"),
                Meal("future-one", today.AddDays(1), futureId, future.GetProperty("profiles")[0].GetProperty("id").GetGuid()),
                Meal("future-two", today.AddDays(2), futureId, future.GetProperty("profiles")[0].GetProperty("id").GetGuid()),
                Meal("future-three", today.AddDays(3), futureId, future.GetProperty("profiles")[0].GetProperty("id").GetGuid()),
            },
            notes = Array.Empty<object>(),
        });
        var allSort = await Tool(client, "search_recipes", new { sort = "MostPlanned" });
        var first = allSort.GetProperty("recipes")[0];
        Assert.Equal(futureId, first.GetProperty("id").GetGuid());
        Assert.Equal(0, first.GetProperty("pastTimesPlanned").GetInt32());
        Assert.Equal(3, first.GetProperty("upcomingTimesPlanned").GetInt32());
        Assert.Equal(JsonValueKind.Null, first.GetProperty("lastPastPlanned").ValueKind);
        var recent = await Tool(client, "search_recipes", new { sort = "MostRecentlyPlanned" });
        Assert.Equal(pastId, recent.GetProperty("recipes")[0].GetProperty("id").GetGuid());
        var least = await Tool(client, "search_recipes", new { sort = "LeastPlanned" });
        Assert.Equal(never.GetProperty("id").GetGuid(), least.GetProperty("recipes")[0].GetProperty("id").GetGuid());
        var details = await Tool(client, "get_recipe", new { recipeId = futureId });
        Assert.Equal(0, details.GetProperty("planningStatistics").GetProperty("timesPlanned").GetInt32());
        Assert.Equal(3, details.GetProperty("planningStatistics").GetProperty("upcomingTimesPlanned").GetInt32());
    }
}
