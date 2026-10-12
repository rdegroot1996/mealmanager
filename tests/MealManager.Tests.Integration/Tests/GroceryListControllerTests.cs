using System.Net;
using System.Net.Http.Json;
using MealManager.Application.DTO;
using MealManager.Common.Enums;
using MealManager.Tests.Integration.Configuration;
using Xunit;
using PlanningEntryDto = MealManager.Application.DTO.PlanningEntryDto;

namespace MealManager.Tests.Integration.Tests;

public class GroceryListControllerTests(CustomWebApplicationFactory factory) : TestWebApplicationFixture(factory)
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
    public async Task GetCycleGroceryList_ReturnsEmptyList()
    {
        var cycle = await CreateCycleAsync();

        var groceryList = await HttpClient.GetFromJsonAsync<GroceryListDto>($"/api/grocery-lists/cycle/{cycle.Id}", JsonOptions);
        Assert.NotNull(groceryList);
        Assert.Equal(cycle.Id, groceryList.PlanningCycleId);
        Assert.Empty(groceryList.Groceries);
        Assert.Empty(groceryList.PlanningMealGroceries);
    }

    [Fact]
    public async Task GetCycleGroceryList_IncludesCommittedMealWithNoGroceries()
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
        var planning = await HttpClient.GetFromJsonAsync<PlanningDto>($"/api/planning/cycle/{cycle.Id}", JsonOptions);

        var mealResponse = await HttpClient.PostAsJsonAsync("/api/planning-meals", new AddPlanningMealDto
        {
            PlanningId = planning!.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = cycle.StartDate,
        });
        var meal = (await mealResponse.Content.ReadFromJsonAsync<PlanningEntryDto>(JsonOptions))!;

        var commitResponse = await HttpClient.PostAsJsonAsync($"/api/planning-meals/{meal.Id}/groceries", new AddMealGroceriesDto
        {
            Groceries = [],
        });
        commitResponse.EnsureSuccessStatusCode();

        var groceryList = await HttpClient.GetFromJsonAsync<GroceryListDto>($"/api/grocery-lists/cycle/{cycle.Id}", JsonOptions);

        var group = Assert.Single(groceryList!.PlanningMealGroceries);
        Assert.Equal(meal.Id, group.PlanningMeal.Id);
        Assert.Empty(group.Groceries);
    }

    [Fact]
    public async Task AddManualGroceryItem_AddsItem()
    {
        var cycle = await CreateCycleAsync();

        var response = await HttpClient.PostAsJsonAsync($"/api/grocery-lists/cycle/{cycle.Id}/items", new AddManualGroceryItemDto
        {
            Name = "Milk",
            Quantity = 2,
        });
        response.EnsureSuccessStatusCode();

        var item = await response.Content.ReadFromJsonAsync<GroceryItemDto>(JsonOptions);
        Assert.NotNull(item);
        Assert.Equal("Milk", item.Name);
        Assert.Equal(2, item.Quantity);
        Assert.False(item.Checked);
        Assert.Null(item.PlanningMealId);
    }

    [Fact]
    public async Task UpdateGroceryItem_UpdatesEditableFieldsAndCheckedState()
    {
        var cycle = await CreateCycleAsync();

        var addResponse = await HttpClient.PostAsJsonAsync($"/api/grocery-lists/cycle/{cycle.Id}/items", new AddManualGroceryItemDto
        {
            Name = "Bread",
            Quantity = 1,
        });
        var item = (await addResponse.Content.ReadFromJsonAsync<GroceryItemDto>(JsonOptions))!;

        var updateResponse = await HttpClient.PutAsJsonAsync($"/api/grocery-lists/{item.Id}", new UpdateGroceryItemDto
        {
            Name = "Sourdough bread",
            Quantity = 2,
            Checked = true,
        });
        updateResponse.EnsureSuccessStatusCode();

        var updated = await updateResponse.Content.ReadFromJsonAsync<GroceryItemDto>(JsonOptions);
        Assert.NotNull(updated);
        Assert.Equal("Sourdough bread", updated.Name);
        Assert.Equal(2, updated.Quantity);
        Assert.True(updated.Checked);
    }

    [Fact]
    public async Task UpdateGroceryItemOrder_PersistsManualGroupOrderAcrossReload()
    {
        var cycle = await CreateCycleAsync();
        var firstResponse = await HttpClient.PostAsJsonAsync($"/api/grocery-lists/cycle/{cycle.Id}/items",
            new AddManualGroceryItemDto { Name = "Bread", Quantity = 1 });
        var secondResponse = await HttpClient.PostAsJsonAsync($"/api/grocery-lists/cycle/{cycle.Id}/items",
            new AddManualGroceryItemDto { Name = "Milk", Quantity = 1 });
        var first = (await firstResponse.Content.ReadFromJsonAsync<GroceryItemDto>(JsonOptions))!;
        var second = (await secondResponse.Content.ReadFromJsonAsync<GroceryItemDto>(JsonOptions))!;
        var list = await HttpClient.GetFromJsonAsync<GroceryListDto>($"/api/grocery-lists/cycle/{cycle.Id}", JsonOptions);

        var reorderResponse = await HttpClient.PutAsJsonAsync($"/api/grocery-lists/{list!.Id}/items/order",
            new UpdateGroceryItemOrderDto { PlanningMealId = null, ItemIds = [second.Id, first.Id] });
        reorderResponse.EnsureSuccessStatusCode();

        var reloaded = await HttpClient.GetFromJsonAsync<GroceryListDto>($"/api/grocery-lists/cycle/{cycle.Id}", JsonOptions);
        Assert.Equal([second.Id, first.Id], reloaded!.Groceries.Select(item => item.Id));
        Assert.Equal([0, 1], reloaded.Groceries.Select(item => item.Order));
    }

    [Fact]
    public async Task UpdateGroceryItemOrder_IncompleteGroup_ReturnsBadRequest()
    {
        var cycle = await CreateCycleAsync();
        var addResponse = await HttpClient.PostAsJsonAsync($"/api/grocery-lists/cycle/{cycle.Id}/items",
            new AddManualGroceryItemDto { Name = "Bread", Quantity = 1 });
        var item = (await addResponse.Content.ReadFromJsonAsync<GroceryItemDto>(JsonOptions))!;
        var list = await HttpClient.GetFromJsonAsync<GroceryListDto>($"/api/grocery-lists/cycle/{cycle.Id}", JsonOptions);

        var response = await HttpClient.PutAsJsonAsync($"/api/grocery-lists/{list!.Id}/items/order",
            new UpdateGroceryItemOrderDto { PlanningMealId = null, ItemIds = [item.Id, Guid.NewGuid()] });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertProblemCode(response, "InvalidGroceryOrder");
    }

    [Fact]
    public async Task RemoveGroceryItem_DeletesItem()
    {
        var cycle = await CreateCycleAsync();

        var addResponse = await HttpClient.PostAsJsonAsync($"/api/grocery-lists/cycle/{cycle.Id}/items", new AddManualGroceryItemDto
        {
            Name = "Eggs",
            Quantity = 12,
        });
        var item = (await addResponse.Content.ReadFromJsonAsync<GroceryItemDto>(JsonOptions))!;

        var deleteResponse = await HttpClient.DeleteAsync($"/api/grocery-lists/{item.Id}");
        deleteResponse.EnsureSuccessStatusCode();

        var groceryList = await HttpClient.GetFromJsonAsync<GroceryListDto>($"/api/grocery-lists/cycle/{cycle.Id}", JsonOptions);
        Assert.NotNull(groceryList);
        Assert.DoesNotContain(groceryList.Groceries, g => g.Id == item.Id);
    }

    [Fact]
    public async Task AddManualGroceryItem_Validation_EmptyName_ReturnsBadRequest()
    {
        var cycle = await CreateCycleAsync();

        var response = await HttpClient.PostAsJsonAsync($"/api/grocery-lists/cycle/{cycle.Id}/items", new AddManualGroceryItemDto
        {
            Name = "",
            Quantity = 1,
        });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task AddManualGroceryItem_Validation_NonPositiveQuantity_ReturnsBadRequest(int quantity)
    {
        var cycle = await CreateCycleAsync();

        var response = await HttpClient.PostAsJsonAsync($"/api/grocery-lists/cycle/{cycle.Id}/items", new AddManualGroceryItemDto
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

        var addResponse = await HttpClient.PostAsJsonAsync($"/api/grocery-lists/cycle/{historical.Id}/items", new AddManualGroceryItemDto
        {
            Name = "Historical milk",
            Quantity = 1,
        });
        addResponse.EnsureSuccessStatusCode();
        var item = (await addResponse.Content.ReadFromJsonAsync<GroceryItemDto>(JsonOptions))!;

        var updateResponse = await HttpClient.PutAsJsonAsync($"/api/grocery-lists/{item.Id}", new UpdateGroceryItemDto
        {
            Name = item.Name,
            Quantity = item.Quantity,
            Checked = true,
        });
        updateResponse.EnsureSuccessStatusCode();

        var deleteResponse = await HttpClient.DeleteAsync($"/api/grocery-lists/{item.Id}");
        deleteResponse.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task GetCycleGroceryList_MissingCycle_ReturnsNotFound()
    {
        var response = await HttpClient.GetAsync($"/api/grocery-lists/cycle/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task AddManualGroceryItem_MissingCycle_ReturnsNotFound()
    {
        var response = await HttpClient.PostAsJsonAsync(
            $"/api/grocery-lists/cycle/{Guid.NewGuid()}/items",
            new AddManualGroceryItemDto { Name = "Milk", Quantity = 1 });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task UpdateGroceryItem_MissingItem_ReturnsNotFound()
    {
        var response = await HttpClient.PutAsJsonAsync(
            $"/api/grocery-lists/{Guid.NewGuid()}",
            new UpdateGroceryItemDto { Name = "Missing", Quantity = 1, Checked = true });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task RemoveGroceryItem_MissingItem_ReturnsNotFound()
    {
        var response = await HttpClient.DeleteAsync($"/api/grocery-lists/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [InlineData(200, HttpStatusCode.Created)]
    [InlineData(201, HttpStatusCode.BadRequest)]
    public async Task AddManualGroceryItem_NameLimitMatchesEditing(int length, HttpStatusCode status)
    {
        var cycle = await CreateCycleAsync();
        var response = await HttpClient.PostAsJsonAsync($"/api/grocery-lists/cycle/{cycle.Id}/items", new AddManualGroceryItemDto
        {
            Name = new string('a', length),
            Quantity = 1,
        });
        Assert.Equal(status, response.StatusCode);
        if (status == HttpStatusCode.Created)
        {
            var item = (await response.Content.ReadFromJsonAsync<GroceryItemDto>(JsonOptions))!;
            var update = await HttpClient.PutAsJsonAsync($"/api/grocery-lists/{item.Id}", new UpdateGroceryItemDto
            {
                Name = new string('b', 201),
                Quantity = 1,
                Checked = false,
            });
            Assert.Equal(HttpStatusCode.BadRequest, update.StatusCode);
        }
    }
}
