using System.Net;
using System.Net.Http.Json;
using MealManager.Application.DTO;
using MealManager.Common.Enums;
using MealManager.Tests.Integration.Configuration;
using Xunit;

namespace MealManager.Tests.Integration.Tests;

public class ShoppingListControllerTests(CustomWebApplicationFactory factory) : TestWebApplicationFixture(factory)
{
    private async Task<PlanningCycleDto> CreateCycleAsync()
    {
        var response = await HttpClient.PostAsJsonAsync("/api/planning-cycles", new CreatePlanningCycleDto
        {
            StartDate = new DateOnly(2025, 1, 6),
            EndDate = new DateOnly(2025, 1, 12),
        });
        return (await response.Content.ReadFromJsonAsync<PlanningCycleDto>(JsonOptions))!;
    }

    [Fact]
    public async Task GetCycleShoppingList_ReturnsEmptyList()
    {
        var cycle = await CreateCycleAsync();

        var shoppingList = await HttpClient.GetFromJsonAsync<ShoppingListDto>($"/api/shopping-lists/cycle/{cycle.Id}", JsonOptions);
        Assert.NotNull(shoppingList);
        Assert.Equal(cycle.Id, shoppingList.PlanningCycleId);
        Assert.Empty(shoppingList.Items);
        Assert.Empty(shoppingList.MealGroups);
    }

    [Fact]
    public async Task GetCycleShoppingList_IncludesCommittedMealWithNoGroceries()
    {
        var cycle = await CreateCycleAsync();
        var recipeResponse = await HttpClient.PostAsJsonAsync("/api/recipes", new CreateRecipeDto
        {
            Name = "Pasta",
            Category = RecipeCategory.Meals,
            BaseServings = 2,
            Tags = [],
            Ingredients = [new RecipeIngredientInputDto { Id = Guid.Empty, Name = "Pasta", Quantity = 1, Unit = "pack" }],
            Steps = [new RecipeStepInputDto { Id = Guid.Empty, Description = "Cook the pasta." }],
        });
        var recipe = (await recipeResponse.Content.ReadFromJsonAsync<RecipeDto>(JsonOptions))!;
        var profile = recipe.Profiles.Single();
        var mealPlan = await HttpClient.GetFromJsonAsync<MealPlanDto>($"/api/meal-plans/cycle/{cycle.Id}", JsonOptions);

        var mealResponse = await HttpClient.PostAsJsonAsync("/api/planned-meals", new AddPlannedMealDto
        {
            MealPlanId = mealPlan!.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = cycle.StartDate,
        });
        var meal = (await mealResponse.Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions))!;

        var commitResponse = await HttpClient.PostAsJsonAsync($"/api/planned-meals/{meal.Id}/groceries", new ReviewMealGroceriesDto
        {
            Groceries = [],
        });
        commitResponse.EnsureSuccessStatusCode();

        var shoppingList = await HttpClient.GetFromJsonAsync<ShoppingListDto>($"/api/shopping-lists/cycle/{cycle.Id}", JsonOptions);

        var group = Assert.Single(shoppingList!.MealGroups);
        Assert.Equal(meal.Id, group.Meal.Id);
        Assert.Empty(group.Items);
    }

    [Fact]
    public async Task AddManualShoppingListItem_AddsItem()
    {
        var cycle = await CreateCycleAsync();

        var response = await HttpClient.PostAsJsonAsync($"/api/shopping-lists/cycle/{cycle.Id}/items", new AddManualShoppingListItemDto
        {
            Name = "Milk",
            Quantity = 2,
        });
        response.EnsureSuccessStatusCode();

        var item = await response.Content.ReadFromJsonAsync<ShoppingListItemDto>(JsonOptions);
        Assert.NotNull(item);
        Assert.Equal("Milk", item.Name);
        Assert.Equal(2, item.Quantity);
        Assert.False(item.Checked);
        Assert.Null(item.PlannedMealId);
    }

    [Fact]
    public async Task UpdateShoppingListItem_UpdatesEditableFieldsAndCheckedState()
    {
        var cycle = await CreateCycleAsync();

        var addResponse = await HttpClient.PostAsJsonAsync($"/api/shopping-lists/cycle/{cycle.Id}/items", new AddManualShoppingListItemDto
        {
            Name = "Bread",
            Quantity = 1,
        });
        var item = (await addResponse.Content.ReadFromJsonAsync<ShoppingListItemDto>(JsonOptions))!;

        var updateResponse = await HttpClient.PutAsJsonAsync($"/api/shopping-lists/{item.Id}", new UpdateShoppingListItemDto
        {
            Name = "Sourdough bread",
            Quantity = 2,
            Checked = true,
        });
        updateResponse.EnsureSuccessStatusCode();

        var updated = await updateResponse.Content.ReadFromJsonAsync<ShoppingListItemDto>(JsonOptions);
        Assert.NotNull(updated);
        Assert.Equal("Sourdough bread", updated.Name);
        Assert.Equal(2, updated.Quantity);
        Assert.True(updated.Checked);
    }

    [Fact]
    public async Task UpdateShoppingListItemOrder_PersistsManualGroupOrderAcrossReload()
    {
        var cycle = await CreateCycleAsync();
        var firstResponse = await HttpClient.PostAsJsonAsync($"/api/shopping-lists/cycle/{cycle.Id}/items",
            new AddManualShoppingListItemDto { Name = "Bread", Quantity = 1 });
        var secondResponse = await HttpClient.PostAsJsonAsync($"/api/shopping-lists/cycle/{cycle.Id}/items",
            new AddManualShoppingListItemDto { Name = "Milk", Quantity = 1 });
        var first = (await firstResponse.Content.ReadFromJsonAsync<ShoppingListItemDto>(JsonOptions))!;
        var second = (await secondResponse.Content.ReadFromJsonAsync<ShoppingListItemDto>(JsonOptions))!;
        var list = await HttpClient.GetFromJsonAsync<ShoppingListDto>($"/api/shopping-lists/cycle/{cycle.Id}", JsonOptions);

        var reorderResponse = await HttpClient.PutAsJsonAsync($"/api/shopping-lists/{list!.Id}/items/order",
            new UpdateShoppingListItemOrderDto { PlannedMealId = null, ItemIds = [second.Id, first.Id] });
        reorderResponse.EnsureSuccessStatusCode();

        var reloaded = await HttpClient.GetFromJsonAsync<ShoppingListDto>($"/api/shopping-lists/cycle/{cycle.Id}", JsonOptions);
        Assert.Equal([second.Id, first.Id], reloaded!.Items.Select(item => item.Id));
        Assert.Equal([0, 1], reloaded.Items.Select(item => item.Order));
    }

    [Fact]
    public async Task UpdateShoppingListItemOrder_IncompleteGroup_ReturnsBadRequest()
    {
        var cycle = await CreateCycleAsync();
        var addResponse = await HttpClient.PostAsJsonAsync($"/api/shopping-lists/cycle/{cycle.Id}/items",
            new AddManualShoppingListItemDto { Name = "Bread", Quantity = 1 });
        var item = (await addResponse.Content.ReadFromJsonAsync<ShoppingListItemDto>(JsonOptions))!;
        var list = await HttpClient.GetFromJsonAsync<ShoppingListDto>($"/api/shopping-lists/cycle/{cycle.Id}", JsonOptions);

        var response = await HttpClient.PutAsJsonAsync($"/api/shopping-lists/{list!.Id}/items/order",
            new UpdateShoppingListItemOrderDto { PlannedMealId = null, ItemIds = [item.Id, Guid.NewGuid()] });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertProblemCode(response, "InvalidShoppingListOrder");
    }

    [Fact]
    public async Task RemoveShoppingListItem_DeletesItem()
    {
        var cycle = await CreateCycleAsync();

        var addResponse = await HttpClient.PostAsJsonAsync($"/api/shopping-lists/cycle/{cycle.Id}/items", new AddManualShoppingListItemDto
        {
            Name = "Eggs",
            Quantity = 12,
        });
        var item = (await addResponse.Content.ReadFromJsonAsync<ShoppingListItemDto>(JsonOptions))!;

        var deleteResponse = await HttpClient.DeleteAsync($"/api/shopping-lists/{item.Id}");
        deleteResponse.EnsureSuccessStatusCode();

        var shoppingList = await HttpClient.GetFromJsonAsync<ShoppingListDto>($"/api/shopping-lists/cycle/{cycle.Id}", JsonOptions);
        Assert.NotNull(shoppingList);
        Assert.DoesNotContain(shoppingList.Items, g => g.Id == item.Id);
    }

    [Fact]
    public async Task AddManualShoppingListItem_Validation_EmptyName_ReturnsBadRequest()
    {
        var cycle = await CreateCycleAsync();

        var response = await HttpClient.PostAsJsonAsync($"/api/shopping-lists/cycle/{cycle.Id}/items", new AddManualShoppingListItemDto
        {
            Name = "",
            Quantity = 1,
        });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task AddManualShoppingListItem_Validation_NonPositiveQuantity_ReturnsBadRequest(int quantity)
    {
        var cycle = await CreateCycleAsync();

        var response = await HttpClient.PostAsJsonAsync($"/api/shopping-lists/cycle/{cycle.Id}/items", new AddManualShoppingListItemDto
        {
            Name = "Milk",
            Quantity = quantity,
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task HistoricalShoppingList_RemainsEditable()
    {
        var historical = await CreateCycleAsync();
        await HttpClient.PostAsJsonAsync("/api/planning-cycles", new CreatePlanningCycleDto
        {
            StartDate = new DateOnly(2025, 1, 13),
            EndDate = new DateOnly(2025, 1, 19),
        });

        var addResponse = await HttpClient.PostAsJsonAsync($"/api/shopping-lists/cycle/{historical.Id}/items", new AddManualShoppingListItemDto
        {
            Name = "Historical milk",
            Quantity = 1,
        });
        addResponse.EnsureSuccessStatusCode();
        var item = (await addResponse.Content.ReadFromJsonAsync<ShoppingListItemDto>(JsonOptions))!;

        var updateResponse = await HttpClient.PutAsJsonAsync($"/api/shopping-lists/{item.Id}", new UpdateShoppingListItemDto
        {
            Name = item.Name,
            Quantity = item.Quantity,
            Checked = true,
        });
        updateResponse.EnsureSuccessStatusCode();

        var deleteResponse = await HttpClient.DeleteAsync($"/api/shopping-lists/{item.Id}");
        deleteResponse.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task GetCycleShoppingList_MissingCycle_ReturnsNotFound()
    {
        var response = await HttpClient.GetAsync($"/api/shopping-lists/cycle/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task AddManualShoppingListItem_MissingCycle_ReturnsNotFound()
    {
        var response = await HttpClient.PostAsJsonAsync(
            $"/api/shopping-lists/cycle/{Guid.NewGuid()}/items",
            new AddManualShoppingListItemDto { Name = "Milk", Quantity = 1 });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task UpdateShoppingListItem_MissingItem_ReturnsNotFound()
    {
        var response = await HttpClient.PutAsJsonAsync(
            $"/api/shopping-lists/{Guid.NewGuid()}",
            new UpdateShoppingListItemDto { Name = "Missing", Quantity = 1, Checked = true });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task RemoveShoppingListItem_MissingItem_ReturnsNotFound()
    {
        var response = await HttpClient.DeleteAsync($"/api/shopping-lists/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [InlineData(200, HttpStatusCode.Created)]
    [InlineData(201, HttpStatusCode.BadRequest)]
    public async Task AddManualShoppingListItem_NameLimitMatchesEditing(int length, HttpStatusCode status)
    {
        var cycle = await CreateCycleAsync();
        var response = await HttpClient.PostAsJsonAsync($"/api/shopping-lists/cycle/{cycle.Id}/items", new AddManualShoppingListItemDto
        {
            Name = new string('a', length),
            Quantity = 1,
        });
        Assert.Equal(status, response.StatusCode);
        if (status == HttpStatusCode.Created)
        {
            var item = (await response.Content.ReadFromJsonAsync<ShoppingListItemDto>(JsonOptions))!;
            var update = await HttpClient.PutAsJsonAsync($"/api/shopping-lists/{item.Id}", new UpdateShoppingListItemDto
            {
                Name = new string('b', 201),
                Quantity = 1,
                Checked = false,
            });
            Assert.Equal(HttpStatusCode.BadRequest, update.StatusCode);
        }
    }
}
