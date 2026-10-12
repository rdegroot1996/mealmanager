using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using MealManager.Tests.Integration.Configuration;
using Xunit;

namespace MealManager.Tests.Integration.Tests;

public sealed partial class McpServerTests(CustomWebApplicationFactory factory) : TestWebApplicationFixture(factory)
{
    private string? _sessionId;
    private int _requestId;

    [Fact]
    public async Task Mcp_RequiresBearerAccessToken()
    {
        using var client = Factory.CreateClient();
        var request = CreateRequest(new
        {
            jsonrpc = "2.0",
            id = 1,
            method = "initialize",
            @params = new
            {
                protocolVersion = "2025-11-25",
                capabilities = new { },
                clientInfo = new { name = "Unauthenticated test", version = "1.0" },
            },
        });

        using var response = await client.SendAsync(request);

        Assert.Equal(System.Net.HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("Bearer", response.Headers.WwwAuthenticate.Single().Scheme);
    }

    [Fact]
    public async Task Mcp_InitializesAndAdvertisesMealManagerTools()
    {
        using var client = CreateAuthenticatedClient();

        var initialize = await Initialize(client);
        Assert.Equal("mealmanager", initialize.RootElement.GetProperty("result")
            .GetProperty("serverInfo").GetProperty("name").GetString());
        Assert.Contains("Planning a meal never adds groceries", initialize.RootElement
            .GetProperty("result").GetProperty("instructions").GetString());
        Assert.Contains("before any write", initialize.RootElement.GetProperty("result").GetProperty("instructions").GetString());
        Assert.Contains("explicit user confirmation", initialize.RootElement.GetProperty("result").GetProperty("instructions").GetString());
        Assert.Contains("recipe and meal date", initialize.RootElement.GetProperty("result").GetProperty("instructions").GetString());
        Assert.Contains("clarify ambiguous matches", initialize.RootElement.GetProperty("result").GetProperty("instructions").GetString());

        var tools = await SendRequest(client, "tools/list", new { });
        var advertised = tools.RootElement.GetProperty("result").GetProperty("tools")
            .EnumerateArray().ToDictionary(tool => tool.GetProperty("name").GetString()!);

        Assert.Contains("search_recipes", advertised.Keys);
        Assert.Contains("remove_grocery_item", advertised.Keys);
        Assert.DoesNotContain("list_ingredients", advertised.Keys);
        Assert.False(advertised["search_recipes"].GetProperty("inputSchema").GetProperty("properties").TryGetProperty("availableIngredients", out _));
        Assert.Contains("expectedRecipeVersion", advertised["update_recipe"].GetProperty("inputSchema").GetProperty("required").EnumerateArray().Select(value => value.GetString()));
        Assert.Contains("expectedProfileVersion", advertised["update_recipe_profile"].GetProperty("inputSchema").GetProperty("required").EnumerateArray().Select(value => value.GetString()));
        Assert.Contains("create_recipe", advertised.Keys);
        Assert.Contains("plan_meal", advertised.Keys);
        Assert.Contains("review_meal_groceries", advertised.Keys);
        Assert.Contains("list_recipe_catalog", advertised.Keys);
        Assert.Contains("list_recipe_tags", advertised.Keys);
        Assert.Contains("update_recipe", advertised.Keys);
        Assert.Contains("apply_planning", advertised.Keys);
        Assert.True(advertised["list_recipe_catalog"].GetProperty("annotations").GetProperty("readOnlyHint").GetBoolean());
        Assert.True(advertised["apply_planning"].GetProperty("annotations").GetProperty("destructiveHint").GetBoolean());
        Assert.True(advertised["update_recipe"].GetProperty("annotations").GetProperty("destructiveHint").GetBoolean());
        Assert.Contains("explicitly confirmed", advertised["create_recipe"].GetProperty("description").GetString());
        Assert.Contains("expectedPlanningVersion", advertised["apply_planning"].GetProperty("inputSchema")
            .GetProperty("required").EnumerateArray().Select(value => value.GetString()));
        Assert.True(advertised["search_recipes"].GetProperty("annotations")
            .GetProperty("readOnlyHint").GetBoolean());
        Assert.False(advertised["plan_meal"].GetProperty("annotations")
            .GetProperty("readOnlyHint").GetBoolean());
    }

    [Fact]
    public async Task Mcp_CreatesSearchesAndPlansRecipeWithoutAddingGroceries()
    {
        using var client = CreateAuthenticatedClient();
        await Initialize(client);

        var created = await CallTool(client, "create_recipe", new
        {
            name = "Chicken vegetable pasta",
            category = "Meals",
            baseServings = 4,
            tags = new[] { "quick" },
            ingredients = new[]
            {
                new { name = "Chicken", quantity = 400, unit = "g" },
                new { name = "Bell pepper", quantity = 2, unit = "pcs" },
                new { name = "Courgette", quantity = 1, unit = "pcs" },
                new { name = "Pasta", quantity = 400, unit = "g" },
            },
            steps = new[] { "Cook the chicken and vegetables.", "Cook the pasta and combine." },
        });
        var recipe = created.RootElement.GetProperty("result").GetProperty("structuredContent");
        var recipeId = recipe.GetProperty("id").GetGuid();
        var profileId = recipe.GetProperty("profiles")[0].GetProperty("id").GetGuid();

        var fetched = await CallTool(client, "get_recipe", new { recipeId });
        var details = fetched.RootElement.GetProperty("result").GetProperty("structuredContent");
        Assert.Equal("Chicken vegetable pasta", details.GetProperty("name").GetString());
        Assert.Equal(4, details.GetProperty("ingredients").GetArrayLength());
        Assert.Equal(2, details.GetProperty("steps").GetArrayLength());

        await CallTool(client, "create_recipe", new
        {
            name = "Bell pepper soup",
            category = "Meals",
            baseServings = 2,
            tags = Array.Empty<string>(),
            ingredients = new[]
            {
                new { name = "Bell pepper", quantity = 2, unit = "pcs" },
                new { name = "Stock", quantity = 500, unit = "ml" },
            },
            steps = new[] { "Simmer the ingredients." },
        });

        var search = await CallTool(client, "search_recipes", new { search = "Chicken", sort = "Name", limit = 10 });
        var matches = search.RootElement.GetProperty("result").GetProperty("structuredContent").GetProperty("recipes");
        var match = Assert.Single(matches.EnumerateArray());
        Assert.Equal(recipeId, match.GetProperty("id").GetGuid());
        Assert.Equal(4, match.GetProperty("ingredients").GetArrayLength());
        Assert.False(match.TryGetProperty("matchedIngredients", out _));

        var today = DateOnly.FromDateTime(DateTime.Today);
        await CallTool(client, "create_planning_cycle", new
        {
            startDate = today,
            endDate = today.AddDays(6),
        });
        var planned = await CallTool(client, "plan_meal", new
        {
            recipeId,
            profileId,
            date = today,
        });
        var meal = planned.RootElement.GetProperty("result").GetProperty("structuredContent");
        Assert.False(meal.GetProperty("hasGroceriesAdded").GetBoolean());

        var active = await CallTool(client, "get_active_planning", new { });
        var entry = active.RootElement.GetProperty("result").GetProperty("structuredContent")
            .GetProperty("planning").GetProperty("entries")[0];
        Assert.Equal(recipeId, entry.GetProperty("recipe").GetProperty("id").GetGuid());
        Assert.False(entry.GetProperty("hasGroceriesAdded").GetBoolean());

        await CallTool(client, "review_meal_groceries", new
        {
            planningMealId = meal.GetProperty("id").GetGuid(),
            groceries = Array.Empty<object>(),
        });
        var reviewed = await CallTool(client, "get_active_planning", new { });
        Assert.True(reviewed.RootElement.GetProperty("result").GetProperty("structuredContent")
            .GetProperty("planning").GetProperty("entries")[0]
            .GetProperty("hasGroceriesAdded").GetBoolean());
    }

    [Fact]
    public async Task Mcp_AddsAndReadsManualGroceries()
    {
        using var client = CreateAuthenticatedClient();
        await Initialize(client);

        var today = DateOnly.FromDateTime(DateTime.Today);
        var cycle = await CallTool(client, "create_planning_cycle", new
        {
            startDate = today,
            endDate = today.AddDays(6),
        });
        var cycleId = cycle.RootElement.GetProperty("result")
            .GetProperty("structuredContent").GetProperty("id").GetGuid();

        var added = await CallTool(client, "add_grocery_item", new { name = "Milk", quantity = 2 });
        var item = added.RootElement.GetProperty("result").GetProperty("structuredContent");
        var itemId = item.GetProperty("id").GetGuid();
        Assert.Equal("Milk", item.GetProperty("name").GetString());
        Assert.Equal(2, item.GetProperty("quantity").GetInt32());

        await CallTool(client, "add_grocery_item", new { name = "Bread", quantity = 1, cycleId });
        var list = await CallTool(client, "get_grocery_list", new { });
        var groceries = list.RootElement.GetProperty("result")
            .GetProperty("structuredContent").GetProperty("groceries").EnumerateArray().ToArray();
        Assert.Equal(2, groceries.Length);
        Assert.Contains(groceries, grocery => grocery.GetProperty("id").GetGuid() == itemId &&
            grocery.GetProperty("name").GetString() == "Milk" &&
            grocery.GetProperty("quantity").GetInt32() == 2);
        Assert.Contains(groceries, grocery => grocery.GetProperty("name").GetString() == "Bread");
    }

    private async Task<JsonDocument> Initialize(HttpClient client)
    {
        var document = await SendRequest(client, "initialize", new
        {
            protocolVersion = "2025-11-25",
            capabilities = new { },
            clientInfo = new { name = "MealManager integration tests", version = "1.0" },
        });
        await SendNotification(client, "notifications/initialized", new { });
        return document;
    }

    private async Task<JsonDocument> CallTool(HttpClient client, string name, object arguments)
    {
        arguments = await WithEditVersion(client, name, arguments);
        var response = await SendRequest(client, "tools/call", new { name, arguments });
        var result = response.RootElement.GetProperty("result");
        Assert.False(result.TryGetProperty("isError", out var error) && error.GetBoolean(), response.RootElement.ToString());
        return response;
    }

    private async Task<object> WithEditVersion(HttpClient client, string name, object arguments)
    {
        if (name is not ("update_recipe" or "update_recipe_profile")) return arguments;
        var values = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(JsonSerializer.Serialize(arguments))!;
        var recipe = name == "update_recipe";
        var expected = recipe ? "expectedRecipeVersion" : "expectedProfileVersion";
        if (values.ContainsKey(expected)) return arguments;
        var id = recipe ? "recipeId" : "profileId";
        var state = await Tool(client, recipe ? "get_recipe" : "get_recipe_profile", new Dictionary<string, JsonElement> { [id] = values[id] });
        values[expected] = state.GetProperty(recipe ? "recipeVersion" : "profileVersion");
        return values;
    }

    private HttpClient CreateAuthenticatedClient()
    {
        var client = Factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            CustomWebApplicationFactory.McpAccessToken);
        return client;
    }

    private async Task<JsonDocument> SendRequest(HttpClient client, string method, object parameters)
    {
        var request = CreateRequest(new
        {
            jsonrpc = "2.0",
            id = ++_requestId,
            method,
            @params = parameters,
        });
        using var response = await client.SendAsync(request);
        response.EnsureSuccessStatusCode();
        CaptureSession(response);
        return ParseResponse(await response.Content.ReadAsStringAsync());
    }

    private async Task SendNotification(HttpClient client, string method, object parameters)
    {
        var request = CreateRequest(new
        {
            jsonrpc = "2.0",
            method,
            @params = parameters,
        });
        using var response = await client.SendAsync(request);
        response.EnsureSuccessStatusCode();
        CaptureSession(response);
    }

    private HttpRequestMessage CreateRequest(object body)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/mcp")
        {
            Content = JsonContent.Create(body),
        };
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("text/event-stream"));
        request.Headers.TryAddWithoutValidation("MCP-Protocol-Version", "2025-11-25");
        if (_sessionId is not null)
        {
            request.Headers.TryAddWithoutValidation("Mcp-Session-Id", _sessionId);
        }
        return request;
    }

    private void CaptureSession(HttpResponseMessage response)
    {
        if (response.Headers.TryGetValues("Mcp-Session-Id", out var values))
        {
            _sessionId = values.Single();
        }
    }

    private static JsonDocument ParseResponse(string body)
    {
        if (!body.StartsWith("event:", StringComparison.Ordinal))
        {
            return JsonDocument.Parse(body);
        }

        var data = body.Split('\n', StringSplitOptions.RemoveEmptyEntries)
            .First(line => line.StartsWith("data: ", StringComparison.Ordinal))[6..];
        return JsonDocument.Parse(data);
    }
}
