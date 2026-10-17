using System.Net;
using System.Net.Http.Json;
using MealManager.Application.DTO;
using MealManager.Application.Mapping;
using MealManager.Common.Enums;
using MealManager.Domain.Entities;
using MealManager.Infrastructure.Database;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace MealManager.Tests.Integration.Tests;

public partial class RecipeControllerTests
{
    private static UpdateRecipeDto EditRecipe(RecipeDto recipe) => new()
    {
        Name = recipe.Name,
        Notes = recipe.Notes,
        Category = recipe.Category,
        BaseServings = recipe.BaseServings,
        Tags = recipe.Tags.Select(tag => tag.Name).ToArray(),
        Ingredients = recipe.Ingredients.Select(row => row.ToInput()).ToArray(),
        Steps = recipe.Steps.Select(row => row.ToInput()).ToArray(),
    };

    [Theory]
    [InlineData(false, false)]
    [InlineData(false, true)]
    [InlineData(true, false)]
    [InlineData(true, true)]
    public async Task UpdateRecipe_RejectsDuplicateOrForeignChildIdsWithoutChangingRecipe(bool steps, bool foreign)
    {
        var created = await HttpClient.PostAsJsonAsync("/api/recipes", CreateTestRecipe("Original"));
        var recipe = (await created.Content.ReadFromJsonAsync<RecipeDto>(JsonOptions))!;
        var otherResponse = await HttpClient.PostAsJsonAsync("/api/recipes", CreateTestRecipe("Other"));
        var other = (await otherResponse.Content.ReadFromJsonAsync<RecipeDto>(JsonOptions))!;
        var request = EditRecipe(recipe) with { Name = "Should not save" };
        if (steps)
        {
            var row = (foreign ? other : recipe).Steps.First().ToInput();
            request = request with { Steps = foreign ? [row] : [row, row] };
        }
        else
        {
            var row = (foreign ? other : recipe).Ingredients.First().ToInput();
            request = request with { Ingredients = foreign ? [row] : [row, row] };
        }
        var response = await HttpClient.PutAsJsonAsync($"/api/recipes/{recipe.Id}", request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertProblemCode(response, "ValidationError");
        var unchanged = await HttpClient.GetFromJsonAsync<RecipeDto>($"/api/recipes/{recipe.Id}", JsonOptions);
        Assert.Equal(recipe.Name, unchanged!.Name);
        Assert.Equal(recipe.Ingredients.Select(row => row.Id), unchanged.Ingredients.Select(row => row.Id));
        Assert.Equal(recipe.Steps.Select(row => row.Id), unchanged.Steps.Select(row => row.Id));
    }

    [Fact]
    public async Task RecipeMutations_RejectBlankTags()
    {
        var invalid = CreateTestRecipe() with { Tags = [" ", "valid"] };
        Assert.Equal(HttpStatusCode.BadRequest, (await HttpClient.PostAsJsonAsync("/api/recipes", invalid)).StatusCode);
        var created = await HttpClient.PostAsJsonAsync("/api/recipes", CreateTestRecipe());
        var recipe = (await created.Content.ReadFromJsonAsync<RecipeDto>(JsonOptions))!;
        var response = await HttpClient.PutAsJsonAsync($"/api/recipes/{recipe.Id}", EditRecipe(recipe) with { Tags = [" ", "valid"] });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task RecipeMutations_StoreExactRepeatedTagsOnce()
    {
        string[] tags = ["Easy", "easy", " Easy ", "Easy"];
        var created = await HttpClient.PostAsJsonAsync("/api/recipes", CreateTestRecipe() with { Tags = tags });
        created.EnsureSuccessStatusCode();
        var recipe = (await created.Content.ReadFromJsonAsync<RecipeDto>(JsonOptions))!;
        Assert.Equal(tags.Distinct().Order(StringComparer.Ordinal), recipe.Tags.Select(tag => tag.Name).Order(StringComparer.Ordinal));
        var response = await HttpClient.PutAsJsonAsync($"/api/recipes/{recipe.Id}", EditRecipe(recipe) with { Tags = tags });
        response.EnsureSuccessStatusCode();
        var updated = (await response.Content.ReadFromJsonAsync<RecipeDto>(JsonOptions))!;
        Assert.Equal(tags.Distinct().Order(StringComparer.Ordinal), updated.Tags.Select(tag => tag.Name).Order(StringComparer.Ordinal));
    }

    [Fact]
    public async Task GetRecipes_ReturnsTheCompleteHouseholdCatalog()
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        db.Recipes.AddRange(Enumerable.Range(0, 501).Select(index => new Recipe
        {
            Id = Guid.CreateVersion7(),
            Name = $"Recipe {index:D3}",
            Category = RecipeCategory.Meals,
            BaseServings = 2,
            Tags = [],
            Ingredients = [],
            Steps = [],
        }));
        await db.SaveChangesAsync();
        var recipes = await HttpClient.GetFromJsonAsync<RecipeSummaryDto[]>("/api/recipes", JsonOptions);
        Assert.Equal(501, recipes!.Length);
        Assert.Equal("Recipe 500", recipes[^1].Name);
    }
}
