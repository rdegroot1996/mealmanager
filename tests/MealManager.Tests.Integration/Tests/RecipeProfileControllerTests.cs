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
    public async Task AddRecipeProfile_CreatesInitialProducts()
    {
        var recipe = await CreateRecipeAsync();

        var response = await HttpClient.PostAsJsonAsync("/api/recipe-profiles", new AddRecipeProfileDto
        {
            RecipeId = recipe.Id,
            Name = "Family",
            Servings = 4,
            Products =
            [
                new RecipeProfileProductInputDto
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
        var product = Assert.Single(profile.Products);
        Assert.NotEqual(Guid.Empty, product.Id);
        Assert.Equal("Flour", product.Name);
        Assert.True(product.AtHome);
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
            Products = [],
        });
        updateResponse.EnsureSuccessStatusCode();

        var updated = await updateResponse.Content.ReadFromJsonAsync<RecipeProfileDto>(JsonOptions);
        Assert.NotNull(updated);
        Assert.Equal("Updated", updated.Name);
        Assert.Equal(6, updated.Servings);
    }

    [Fact]
    public async Task UpdateRecipeProfile_UpdatesExistingProducts()
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

        var productId = Guid.NewGuid();
        await HttpClient.PutAsJsonAsync($"/api/recipe-profiles/{created.Id}", new UpdateRecipeProfileDto
        {
            Name = created.Name,
            Servings = created.Servings,
            Products = [new RecipeProfileProductInputDto { Id = productId, Name = "Pasta", Quantity = 2, AtHome = false }],
        });

        var updateResponse = await HttpClient.PutAsJsonAsync($"/api/recipe-profiles/{created.Id}", new UpdateRecipeProfileDto
        {
            Name = created.Name,
            Servings = created.Servings,
            Products = [new RecipeProfileProductInputDto { Id = productId, Name = "Whole-wheat pasta", Quantity = 3, AtHome = true }],
        });
        updateResponse.EnsureSuccessStatusCode();

        var updated = await updateResponse.Content.ReadFromJsonAsync<RecipeProfileDto>(JsonOptions);
        Assert.NotNull(updated);
        var product = Assert.Single(updated.Products);
        Assert.Equal(productId, product.Id);
        Assert.Equal("Whole-wheat pasta", product.Name);
        Assert.Equal(3, product.Quantity);
        Assert.True(product.AtHome);
        Assert.Equal(0, product.Order);
    }

    [Fact]
    public async Task UpdateRecipeProfile_CreatesProductsWithEmptyIds()
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
            Products =
            [
                new RecipeProfileProductInputDto { Id = Guid.Empty, Name = "Pasta", Quantity = 2, AtHome = false },
                new RecipeProfileProductInputDto { Id = Guid.Empty, Name = "Sauce", Quantity = 1, AtHome = false },
            ],
        });
        response.EnsureSuccessStatusCode();

        var updated = await response.Content.ReadFromJsonAsync<RecipeProfileDto>(JsonOptions);
        Assert.NotNull(updated);
        Assert.Equal(2, updated.Products.Count);
        Assert.All(updated.Products, product => Assert.NotEqual(Guid.Empty, product.Id));
        Assert.Equal(2, updated.Products.Select(product => product.Id).Distinct().Count());
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
            new UpdateRecipeProfileDto { Name = "Missing", Servings = 2, Products = [] });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task UpdateRecipeProfile_InvalidProduct_ReturnsBadRequest()
    {
        var recipe = await CreateRecipeAsync();
        var profile = Assert.Single(recipe.Profiles);
        var response = await HttpClient.PutAsJsonAsync(
            $"/api/recipe-profiles/{profile.Id}",
            new UpdateRecipeProfileDto
            {
                Name = profile.Name,
                Servings = profile.Servings,
                Products = [new RecipeProfileProductInputDto { Id = Guid.Empty, Name = "", Quantity = 0, AtHome = false }],
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
    public async Task UpdateRecipeProfile_RejectsDuplicateOrForeignProductIds(bool foreign)
    {
        var recipe = await CreateRecipeAsync();
        var ownId = Assert.Single(recipe.Profiles).Id;
        var otherResponse = await HttpClient.PostAsJsonAsync("/api/recipe-profiles", new AddRecipeProfileDto
        {
            RecipeId = recipe.Id,
            Name = "Other",
            Servings = 2,
            Products = [new RecipeProfileProductInputDto { Name = "Rice", Quantity = 1, AtHome = false }],
        });
        var other = (await otherResponse.Content.ReadFromJsonAsync<RecipeProfileDto>(JsonOptions))!;
        var row = new RecipeProfileProductInputDto { Id = foreign ? Assert.Single(other.Products).Id : Guid.NewGuid(), Name = "Rice", Quantity = 1, AtHome = false };
        var response = await HttpClient.PutAsJsonAsync($"/api/recipe-profiles/{ownId}", new UpdateRecipeProfileDto
        {
            Name = "Should not save",
            Servings = 2,
            Products = foreign ? [row] : [row, row],
        });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertProblemCode(response, "ValidationError");
        var unchanged = await HttpClient.GetFromJsonAsync<RecipeProfileDto>($"/api/recipe-profiles/{ownId}", JsonOptions);
        Assert.Equal("Default", unchanged!.Name);
        Assert.Empty(unchanged.Products);
    }

    [Fact]
    public async Task RecipeProfileMutations_RejectOverlongProductNames()
    {
        var recipe = await CreateRecipeAsync();
        var row = new RecipeProfileProductInputDto { Name = new string('a', 201), Quantity = 1, AtHome = false };
        var create = await HttpClient.PostAsJsonAsync("/api/recipe-profiles", new AddRecipeProfileDto
        {
            RecipeId = recipe.Id,
            Name = "New",
            Servings = 2,
            Products = [row],
        });
        Assert.Equal(HttpStatusCode.BadRequest, create.StatusCode);
        var update = await HttpClient.PutAsJsonAsync($"/api/recipe-profiles/{Assert.Single(recipe.Profiles).Id}", new UpdateRecipeProfileDto
        {
            Name = "Default",
            Servings = 2,
            Products = [row],
        });
        Assert.Equal(HttpStatusCode.BadRequest, update.StatusCode);
    }
}
