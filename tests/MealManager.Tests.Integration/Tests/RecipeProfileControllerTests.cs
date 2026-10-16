using System.Net;
using System.Net.Http.Json;
using MealManager.Application.DTO;
using MealManager.Common.Enums;
using MealManager.Tests.Integration.Configuration;
using Xunit;

namespace MealManager.Tests.Integration.Tests;

public class RecipeProfileControllerTests(CustomWebApplicationFactory factory) : TestWebApplicationFixture(factory)
{
    private async Task<RecipeDto> CreateRecipeAsync()
    {
        var response = await HttpClient.PostAsJsonAsync("/api/recipes", new CreateRecipeDto
        {
            Name = "Profile Test Recipe",
            Category = RecipeCategory.Meals,
            BaseServings = 2,
            Tags = ["test"],
            Ingredients = [new RecipeIngredientInputDto { Id = Guid.Empty, Name = "Flour", Quantity = 200, Unit = "g" }],
            Steps = [new RecipeStepInputDto { Id = Guid.Empty, Description = "Mix" }],
        });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<RecipeDto>(JsonOptions))!;
    }

    [Fact]
    public async Task AddRecipeProfile_CreatesProfile()
    {
        var recipe = await CreateRecipeAsync();

        var response = await HttpClient.PostAsJsonAsync("/api/recipe-profiles", new AddRecipeProfileDto
        {
            RecipeId = recipe.Id,
            Name = "Family",
            Servings = 4,
        });
        var body = await response.Content.ReadAsStringAsync();
        Assert.True(response.IsSuccessStatusCode, $"Status: {response.StatusCode}, Body: {body}");

        var profile = System.Text.Json.JsonSerializer.Deserialize<RecipeProfileDto>(body, JsonOptions);
        Assert.NotNull(profile);
        Assert.Equal("Family", profile.Name);
        Assert.Equal(4, profile.Servings);
    }

    [Fact]
    public async Task AddRecipeProfile_CreatesInitialGroceries()
    {
        var recipe = await CreateRecipeAsync();

        var response = await HttpClient.PostAsJsonAsync("/api/recipe-profiles", new AddRecipeProfileDto
        {
            RecipeId = recipe.Id,
            Name = "Family",
            Servings = 4,
            Groceries =
            [
                new RecipeProfileGroceryItemInputDto
                {
                    Id = Guid.Empty,
                    Name = "Flour",
                    Quantity = 1,
                    AtHome = true,
                },
            ],
        });

        response.EnsureSuccessStatusCode();
        var profile = (await response.Content.ReadFromJsonAsync<RecipeProfileDto>(JsonOptions))!;
        var item = Assert.Single(profile.Groceries);
        Assert.NotEqual(Guid.Empty, item.Id);
        Assert.Equal("Flour", item.Name);
        Assert.True(item.AtHome);
    }

    [Fact]
    public async Task GetRecipeProfile_ReturnsById()
    {
        var recipe = await CreateRecipeAsync();
        var addResponse = await HttpClient.PostAsJsonAsync("/api/recipe-profiles", new AddRecipeProfileDto
        {
            RecipeId = recipe.Id,
            Name = "Solo",
            Servings = 1,
        });
        var created = await addResponse.Content.ReadFromJsonAsync<RecipeProfileDto>(JsonOptions);
        Assert.NotNull(created);

        var profile = await HttpClient.GetFromJsonAsync<RecipeProfileDto>($"/api/recipe-profiles/{created.Id}", JsonOptions);
        Assert.NotNull(profile);
        Assert.Equal("Solo", profile.Name);
    }

    [Fact]
    public async Task UpdateRecipeProfile_UpdatesFields()
    {
        var recipe = await CreateRecipeAsync();
        var addResponse = await HttpClient.PostAsJsonAsync("/api/recipe-profiles", new AddRecipeProfileDto
        {
            RecipeId = recipe.Id,
            Name = "Original",
            Servings = 2,
        });
        var created = await addResponse.Content.ReadFromJsonAsync<RecipeProfileDto>(JsonOptions);
        Assert.NotNull(created);

        var updateResponse = await HttpClient.PutAsJsonAsync($"/api/recipe-profiles/{created.Id}", new UpdateRecipeProfileDto
        {
            Name = "Updated",
            Servings = 6,
            Groceries = [],
        });
        updateResponse.EnsureSuccessStatusCode();

        var updated = await updateResponse.Content.ReadFromJsonAsync<RecipeProfileDto>(JsonOptions);
        Assert.NotNull(updated);
        Assert.Equal("Updated", updated.Name);
        Assert.Equal(6, updated.Servings);
    }

    [Fact]
    public async Task UpdateRecipeProfile_UpdatesExistingGroceries()
    {
        var recipe = await CreateRecipeAsync();
        var addResponse = await HttpClient.PostAsJsonAsync("/api/recipe-profiles", new AddRecipeProfileDto
        {
            RecipeId = recipe.Id,
            Name = "Family",
            Servings = 4,
        });
        var created = await addResponse.Content.ReadFromJsonAsync<RecipeProfileDto>(JsonOptions);
        Assert.NotNull(created);

        var groceryItemId = Guid.NewGuid();
        await HttpClient.PutAsJsonAsync($"/api/recipe-profiles/{created.Id}", new UpdateRecipeProfileDto
        {
            Name = created.Name,
            Servings = created.Servings,
            Groceries = [new RecipeProfileGroceryItemInputDto { Id = groceryItemId, Name = "Pasta", Quantity = 2, AtHome = false }],
        });

        var updateResponse = await HttpClient.PutAsJsonAsync($"/api/recipe-profiles/{created.Id}", new UpdateRecipeProfileDto
        {
            Name = created.Name,
            Servings = created.Servings,
            Groceries = [new RecipeProfileGroceryItemInputDto { Id = groceryItemId, Name = "Whole-wheat pasta", Quantity = 3, AtHome = true }],
        });
        updateResponse.EnsureSuccessStatusCode();

        var updated = await updateResponse.Content.ReadFromJsonAsync<RecipeProfileDto>(JsonOptions);
        Assert.NotNull(updated);
        var item = Assert.Single(updated.Groceries);
        Assert.Equal(groceryItemId, item.Id);
        Assert.Equal("Whole-wheat pasta", item.Name);
        Assert.Equal(3, item.Quantity);
        Assert.True(item.AtHome);
        Assert.Equal(0, item.Order);
    }

    [Fact]
    public async Task UpdateRecipeProfile_CreatesGroceriesWithEmptyIds()
    {
        var recipe = await CreateRecipeAsync();
        var addResponse = await HttpClient.PostAsJsonAsync("/api/recipe-profiles", new AddRecipeProfileDto
        {
            RecipeId = recipe.Id,
            Name = "Family",
            Servings = 4,
        });
        var created = await addResponse.Content.ReadFromJsonAsync<RecipeProfileDto>(JsonOptions);
        Assert.NotNull(created);

        var response = await HttpClient.PutAsJsonAsync($"/api/recipe-profiles/{created.Id}", new UpdateRecipeProfileDto
        {
            Name = created.Name,
            Servings = created.Servings,
            Groceries =
            [
                new RecipeProfileGroceryItemInputDto { Id = Guid.Empty, Name = "Pasta", Quantity = 2, AtHome = false },
                new RecipeProfileGroceryItemInputDto { Id = Guid.Empty, Name = "Sauce", Quantity = 1, AtHome = false },
            ],
        });
        response.EnsureSuccessStatusCode();

        var updated = await response.Content.ReadFromJsonAsync<RecipeProfileDto>(JsonOptions);
        Assert.NotNull(updated);
        Assert.Equal(2, updated.Groceries.Count);
        Assert.All(updated.Groceries, item => Assert.NotEqual(Guid.Empty, item.Id));
        Assert.Equal(2, updated.Groceries.Select(item => item.Id).Distinct().Count());
    }

    [Fact]
    public async Task DeleteRecipeProfile_RemovesProfile()
    {
        var recipe = await CreateRecipeAsync();
        var addResponse = await HttpClient.PostAsJsonAsync("/api/recipe-profiles", new AddRecipeProfileDto
        {
            RecipeId = recipe.Id,
            Name = "ToDelete",
            Servings = 3,
        });
        var created = await addResponse.Content.ReadFromJsonAsync<RecipeProfileDto>(JsonOptions);
        Assert.NotNull(created);

        var deleteResponse = await HttpClient.DeleteAsync($"/api/recipe-profiles/{created.Id}");
        deleteResponse.EnsureSuccessStatusCode();

        var getResponse = await HttpClient.GetAsync($"/api/recipe-profiles/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResponse.StatusCode);
    }

    [Fact]
    public async Task DeleteRecipeProfile_LastProfile_ReturnsBadRequest()
    {
        var recipe = await CreateRecipeAsync();
        var profile = Assert.Single(recipe.Profiles);

        var response = await HttpClient.DeleteAsync($"/api/recipe-profiles/{profile.Id}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertProblemCode(response, "RecipeMustKeepProfile");
        var preserved = await HttpClient.GetAsync($"/api/recipe-profiles/{profile.Id}");
        preserved.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task AddRecipeProfile_MissingRecipe_ReturnsNotFound()
    {
        var response = await HttpClient.PostAsJsonAsync("/api/recipe-profiles", new AddRecipeProfileDto
        {
            RecipeId = Guid.NewGuid(),
            Name = "Default",
            Servings = 2,
        });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task AddRecipeProfile_EmptyName_ReturnsBadRequest()
    {
        var recipe = await CreateRecipeAsync();
        var response = await HttpClient.PostAsJsonAsync("/api/recipe-profiles", new AddRecipeProfileDto
        {
            RecipeId = recipe.Id,
            Name = "",
            Servings = 2,
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetRecipeProfile_MissingProfile_ReturnsNotFound()
    {
        var response = await HttpClient.GetAsync($"/api/recipe-profiles/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task UpdateRecipeProfile_MissingProfile_ReturnsNotFound()
    {
        var response = await HttpClient.PutAsJsonAsync(
            $"/api/recipe-profiles/{Guid.NewGuid()}",
            new UpdateRecipeProfileDto { Name = "Missing", Servings = 2, Groceries = [] });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task UpdateRecipeProfile_InvalidGroceryItem_ReturnsBadRequest()
    {
        var recipe = await CreateRecipeAsync();
        var profile = Assert.Single(recipe.Profiles);
        var response = await HttpClient.PutAsJsonAsync(
            $"/api/recipe-profiles/{profile.Id}",
            new UpdateRecipeProfileDto
            {
                Name = profile.Name,
                Servings = profile.Servings,
                Groceries = [new RecipeProfileGroceryItemInputDto { Id = Guid.Empty, Name = "", Quantity = 0, AtHome = false }],
            });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task DeleteRecipeProfile_MissingProfile_ReturnsNotFound()
    {
        var response = await HttpClient.DeleteAsync($"/api/recipe-profiles/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task UpdateRecipeProfile_RejectsDuplicateOrForeignGroceryItemIds(bool foreign)
    {
        var recipe = await CreateRecipeAsync();
        var ownId = Assert.Single(recipe.Profiles).Id;
        var otherResponse = await HttpClient.PostAsJsonAsync("/api/recipe-profiles", new AddRecipeProfileDto
        {
            RecipeId = recipe.Id,
            Name = "Other",
            Servings = 2,
            Groceries = [new RecipeProfileGroceryItemInputDto { Name = "Rice", Quantity = 1, AtHome = false }],
        });
        var other = (await otherResponse.Content.ReadFromJsonAsync<RecipeProfileDto>(JsonOptions))!;
        var row = new RecipeProfileGroceryItemInputDto { Id = foreign ? Assert.Single(other.Groceries).Id : Guid.NewGuid(), Name = "Rice", Quantity = 1, AtHome = false };
        var response = await HttpClient.PutAsJsonAsync($"/api/recipe-profiles/{ownId}", new UpdateRecipeProfileDto
        {
            Name = "Should not save",
            Servings = 2,
            Groceries = foreign ? [row] : [row, row],
        });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertProblemCode(response, "ValidationError");
        var unchanged = await HttpClient.GetFromJsonAsync<RecipeProfileDto>($"/api/recipe-profiles/{ownId}", JsonOptions);
        Assert.Equal("Default", unchanged!.Name);
        Assert.Empty(unchanged.Groceries);
    }

    [Fact]
    public async Task RecipeProfileMutations_RejectOverlongGroceryItemNames()
    {
        var recipe = await CreateRecipeAsync();
        var row = new RecipeProfileGroceryItemInputDto { Name = new string('a', 201), Quantity = 1, AtHome = false };
        var create = await HttpClient.PostAsJsonAsync("/api/recipe-profiles", new AddRecipeProfileDto
        {
            RecipeId = recipe.Id,
            Name = "New",
            Servings = 2,
            Groceries = [row],
        });
        Assert.Equal(HttpStatusCode.BadRequest, create.StatusCode);
        var update = await HttpClient.PutAsJsonAsync($"/api/recipe-profiles/{Assert.Single(recipe.Profiles).Id}", new UpdateRecipeProfileDto
        {
            Name = "Default",
            Servings = 2,
            Groceries = [row],
        });
        Assert.Equal(HttpStatusCode.BadRequest, update.StatusCode);
    }
}
