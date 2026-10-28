using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using MealManager.Api.Mcp;
using MealManager.Application.DTO;
using Xunit;

namespace MealManager.Tests.Integration.Tests;

public sealed partial class McpServerTests
{
    [Fact]
    public async Task Mcp_HistoryMatchesSearchAndUpcomingReadsAcrossCycles()
    {
        using var client = CreateAuthenticatedClient();
        await Initialize(client);
        var recipe = await CreateTestRecipe(client);
        var recipeId = recipe.GetProperty("id").GetGuid();
        var profileId = recipe.GetProperty("profiles")[0].GetProperty("id").GetGuid();
        var neverPlanned = await CreateTestRecipe(client);
        await Tool(client, "set_recipe_favorite", new { recipeId, isFavorite = true });
        var today = DateOnly.FromDateTime(DateTime.Today);
        var first = await Tool(client, "create_planning_cycle", new
        {
            startDate = today.AddDays(-2),
            endDate = today.AddDays(1),
            expectedMealPlanVersion = "none",
            entries = new[]
            {
                Meal("original", today.AddDays(-1), recipeId, profileId),
                Leftover("leftover", today, originalKey: "original"),
                Meal("today-one", today, recipeId, profileId),
                Meal("today-two", today, recipeId, profileId),
                Meal("tomorrow", today.AddDays(1), recipeId, profileId),
            },
            notes = new[] { Note("out", today.AddDays(-2), "Eating out") },
        });
        await Tool(client, "create_planning_cycle", new
        {
            startDate = today.AddDays(3),
            endDate = today.AddDays(8),
            expectedMealPlanVersion = first.GetProperty("mealPlanVersion").GetString(),
            entries = new[] { Meal("future", today.AddDays(3), recipeId, profileId) },
            notes = Array.Empty<object>(),
        });

        var catalog = await Tool(client, "list_recipe_catalog", new { });
        var planned = catalog.GetProperty("recipes").EnumerateArray().Single(row => row.GetProperty("id").GetGuid() == recipeId);
        Assert.True(planned.GetProperty("isFavorite").GetBoolean());
        Assert.Equal(3, planned.GetProperty("pastTimesPlanned").GetInt32());
        Assert.Equal(2, planned.GetProperty("upcomingTimesPlanned").GetInt32());
        Assert.Equal(today, planned.GetProperty("lastPastPlanned").Deserialize<DateOnly>());
        var never = catalog.GetProperty("recipes").EnumerateArray().Single(row => row.GetProperty("id").GetGuid() == neverPlanned.GetProperty("id").GetGuid());
        Assert.False(never.GetProperty("isFavorite").GetBoolean());
        Assert.Equal(0, never.GetProperty("pastTimesPlanned").GetInt32());
        Assert.Equal(JsonValueKind.Null, never.GetProperty("lastPastPlanned").ValueKind);
        var search = await Tool(client, "search_recipes", new { favorite = true });
        var searched = Assert.Single(search.GetProperty("recipes").EnumerateArray());
        Assert.Equal(planned.GetProperty("pastTimesPlanned").GetInt32(), searched.GetProperty("pastTimesPlanned").GetInt32());
        Assert.Equal(planned.GetProperty("lastPastPlanned").GetString(), searched.GetProperty("lastPastPlanned").GetString());

        var history = await Tool(client, "list_recent_planning_cycles", new { });
        var cycle = Assert.Single(history.GetProperty("cycles").EnumerateArray());
        Assert.Equal(first.GetProperty("id").GetGuid(), cycle.GetProperty("id").GetGuid());
        Assert.Equal(5, cycle.GetProperty("entries").GetArrayLength());
        Assert.Equal("Eating out", cycle.GetProperty("notes")[0].GetProperty("text").GetString());
        Assert.Equal("Leftover", cycle.GetProperty("entries")[1].GetProperty("kind").GetString());
        Assert.Equal(first.GetProperty("createdIds").GetProperty("original").GetGuid(),
            cycle.GetProperty("entries")[1].GetProperty("originalMealId").GetGuid());

        var upcoming = (await HttpClient.GetFromJsonAsync<UpcomingMealPlanDto>($"/api/meal-plans/upcoming?fromDate={today:yyyy-MM-dd}", JsonOptions))!;
        Assert.Equal(today, upcoming.FromDate);
        Assert.Equal(new[] { today, today.AddDays(1), today.AddDays(3) }, upcoming.PlannedDates);
        Assert.Equal(new[] { "leftover", "today-one", "today-two" }.Select(key => first.GetProperty("createdIds").GetProperty(key).GetGuid()),
            upcoming.Entries.Select(entry => entry.Id));
        Assert.Equal(recipeId, upcoming.Entries.First().Recipe.Id);
        var afterGap = (await HttpClient.GetFromJsonAsync<UpcomingMealPlanDto>($"/api/meal-plans/upcoming?fromDate={today.AddDays(2):yyyy-MM-dd}", JsonOptions))!;
        Assert.Single(afterGap.Entries);
        Assert.Equal(today.AddDays(3), afterGap.Entries.First().Date);
        var empty = (await HttpClient.GetFromJsonAsync<UpcomingMealPlanDto>("/api/meal-plans/upcoming?fromDate=9999-12-25", JsonOptions))!;
        Assert.Empty(empty.Entries);
        Assert.Empty(empty.PlannedDates);
    }

    [Fact]
    public async Task Mcp_RecentCyclesAreBoundedAndContinueWithoutRepeating()
    {
        using var client = CreateAuthenticatedClient();
        var initialization = await Initialize(client);
        var instructions = initialization.RootElement.GetProperty("result").GetProperty("instructions").GetString()!;
        using var reader = new StreamReader(typeof(MealManagerMcpTools).Assembly
            .GetManifestResourceStream("MealManager.Api.Mcp.Instructions.md")!);
        Assert.Equal(reader.ReadToEnd(), instructions);
        Assert.Contains("list_recent_planning_cycles", instructions);
        Assert.Contains("minced beef", instructions);
        Assert.Contains("Omitted entries and notes are removed", instructions);
        var tools = await SendRequest(client, "tools/list", new { });
        var tool = tools.RootElement.GetProperty("result").GetProperty("tools").EnumerateArray()
            .Single(value => value.GetProperty("name").GetString() == "list_recent_planning_cycles");
        Assert.True(tool.GetProperty("annotations").GetProperty("readOnlyHint").GetBoolean());
        Assert.Empty((await Tool(client, "list_recent_planning_cycles", new { })).GetProperty("cycles").EnumerateArray());
        var today = DateOnly.FromDateTime(DateTime.Today);
        for (var index = 0; index < 5; index++)
            await Tool(client, "create_planning_cycle", new { startDate = today.AddDays(-25 + index * 5), endDate = today.AddDays(-21 + index * 5) });
        await Tool(client, "create_planning_cycle", new { startDate = today.AddDays(2), endDate = today.AddDays(6) });
        var page = await Tool(client, "list_recent_planning_cycles", new { });
        var starts = page.GetProperty("cycles").EnumerateArray().Select(row => row.GetProperty("startDate").Deserialize<DateOnly>()).ToArray();
        Assert.Equal(new[] { today.AddDays(-5), today.AddDays(-10), today.AddDays(-15), today.AddDays(-20) }, starts);
        Assert.All(page.GetProperty("cycles").EnumerateArray(), row => Assert.Empty(row.GetProperty("entries").EnumerateArray()));
        var older = await Tool(client, "list_recent_planning_cycles", new { beforeStartDate = page.GetProperty("nextBeforeStartDate").GetString() });
        Assert.Equal(today.AddDays(-25), Assert.Single(older.GetProperty("cycles").EnumerateArray()).GetProperty("startDate").Deserialize<DateOnly>());
        Assert.Equal(JsonValueKind.Null, older.GetProperty("nextBeforeStartDate").ValueKind);
        var explicitRange = await Tool(client, "list_recent_planning_cycles", new { beforeStartDate = today.AddDays(7), limit = 12 });
        Assert.Equal(6, explicitRange.GetProperty("cycles").GetArrayLength());
        await ToolError(client, "list_recent_planning_cycles", new { limit = 0 }, "ValidationError");
        await ToolError(client, "list_recent_planning_cycles", new { limit = 13 }, "ValidationError");
    }

    [Fact]
    public async Task GrocerySuggestionsUseRetainedNamesFromManualAndMealHistory()
    {
        using var client = CreateAuthenticatedClient();
        await Initialize(client);
        var recipe = await CreateTestRecipe(client);
        var recipeId = recipe.GetProperty("id").GetGuid();
        var profileId = recipe.GetProperty("profiles")[0].GetProperty("id").GetGuid();
        var start = new DateOnly(2026, 1, 1);
        var first = await Tool(client, "create_planning_cycle", new
        {
            startDate = start,
            endDate = start.AddDays(4),
            expectedMealPlanVersion = "none",
            entries = new[] { Meal("meal", start, recipeId, profileId) },
            notes = Array.Empty<object>(),
        });
        var mealId = first.GetProperty("createdIds").GetProperty("meal").GetGuid();
        await Tool(client, "review_meal_groceries", new { plannedMealId = mealId, groceries = new[] { new { name = "WC papier", quantity = 2 } } });
        var duplicate = await Tool(client, "add_shopping_list_item", new { name = "wc papier", quantity = 1 });
        await Tool(client, "add_shopping_list_item", new { name = "Vochtig wc papier", quantity = 1 });
        await Tool(client, "create_planning_cycle", new { startDate = start.AddDays(5), endDate = start.AddDays(9) });
        await Tool(client, "add_shopping_list_item", new { name = "wc borstel", quantity = 1 });
        var names = await HttpClient.GetFromJsonAsync<string[]>("/api/shopping-lists/suggestions?search=%20WC%20", JsonOptions);
        Assert.Equal(new[] { "wc borstel", "WC papier", "Vochtig wc papier" }, names);
        Assert.Single((await HttpClient.GetFromJsonAsync<string[]>("/api/shopping-lists/suggestions?search=wc&limit=1", JsonOptions))!);
        Assert.Empty((await HttpClient.GetFromJsonAsync<string[]>("/api/shopping-lists/suggestions?search=unknown", JsonOptions))!);
        Assert.Empty((await HttpClient.GetFromJsonAsync<string[]>("/api/shopping-lists/suggestions?search=%20", JsonOptions))!);
        await Tool(client, "remove_shopping_list_item", new { shoppingListItemId = duplicate.GetProperty("id").GetGuid() });
        var list = await Tool(client, "get_shopping_list", new { cycleId = first.GetProperty("id").GetGuid() });
        var originalItemId = list.GetProperty("mealGroups")[0].GetProperty("items")[0].GetProperty("id").GetGuid();
        await Tool(client, "remove_shopping_list_item", new { shoppingListItemId = originalItemId });
        names = await HttpClient.GetFromJsonAsync<string[]>("/api/shopping-lists/suggestions?search=wc", JsonOptions);
        Assert.Equal(new[] { "wc borstel", "Vochtig wc papier" }, names);
    }

    [Theory]
    [InlineData("/api/meal-plans/upcoming", HttpStatusCode.UnprocessableEntity)]
    [InlineData("/api/meal-plans/upcoming?fromDate=invalid", HttpStatusCode.UnprocessableEntity)]
    [InlineData("/api/meal-plans/upcoming?fromDate=9999-12-31", HttpStatusCode.BadRequest)]
    [InlineData("/api/shopping-lists/suggestions?search=wc&limit=0", HttpStatusCode.BadRequest)]
    [InlineData("/api/shopping-lists/suggestions?search=wc&limit=21", HttpStatusCode.BadRequest)]
    public async Task DiscoveryReadsValidateInputsAndRequireAuthentication(string url, HttpStatusCode expectedStatus)
    {
        Assert.Equal(expectedStatus, (await HttpClient.GetAsync(url)).StatusCode);
        using var anonymous = CreateUnauthenticatedApiClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(url)).StatusCode);
    }
}
