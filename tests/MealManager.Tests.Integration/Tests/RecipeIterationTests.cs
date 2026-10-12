using System.Net;
using System.Net.Http.Json;
using MealManager.Application.DTO;
using MealManager.Application.DTO.Mcp;
using MealManager.Common.Enums;
using Xunit;

namespace MealManager.Tests.Integration.Tests;

public partial class RecipeControllerTests
{
    [Theory]
    [InlineData(RecipeCategory.Meals)]
    [InlineData(RecipeCategory.Baking)]
    [InlineData(RecipeCategory.Desserts)]
    [InlineData(RecipeCategory.Snacks)]
    [InlineData(RecipeCategory.Other)]
    public async Task RecipeNotes_RoundTripAndClear(RecipeCategory category)
    {
        var response = await HttpClient.PostAsJsonAsync("/api/recipes", CreateTestRecipe() with
        {
            Category = category,
            Notes = "Book, page 42\nUse less salt.",
            Ingredients = [],
            Steps = [],
        });
        response.EnsureSuccessStatusCode();
        var created = (await response.Content.ReadFromJsonAsync<RecipeDto>(JsonOptions))!;
        var loaded = (await HttpClient.GetFromJsonAsync<RecipeDetailsDto>($"/api/recipes/{created.Id}", JsonOptions))!;
        Assert.Equal("Book, page 42\nUse less salt.", loaded.Notes);
        Assert.Equal(category, loaded.Category);
        var update = new UpdateRecipeDto
        {
            Name = loaded.Name,
            Category = loaded.Category,
            BaseServings = loaded.BaseServings,
            Notes = "",
            Tags = [],
            Ingredients = [],
            Steps = [],
        };
        (await HttpClient.PutAsJsonAsync($"/api/recipes/{created.Id}", update)).EnsureSuccessStatusCode();
        Assert.Equal("", (await HttpClient.GetFromJsonAsync<RecipeDetailsDto>($"/api/recipes/{created.Id}", JsonOptions))!.Notes);
        Assert.Equal(HttpStatusCode.BadRequest, (await HttpClient.PostAsJsonAsync("/api/recipes",
            CreateTestRecipe() with { Notes = new string('x', 4001) })).StatusCode);
    }

    [Fact]
    public async Task RecipeTags_AreRankedByRecipeUseAndSearchable()
    {
        foreach (var tags in new[] { new[] { "popular", "alpha" }, new[] { "popular" }, new[] { "zeta" } })
            (await HttpClient.PostAsJsonAsync("/api/recipes", CreateTestRecipe() with { Tags = tags })).EnsureSuccessStatusCode();
        var result = (await HttpClient.GetFromJsonAsync<RecipeTagSummaryDto[]>("/api/recipes/tags", JsonOptions))!;
        Assert.Equal(new[] { "popular", "alpha", "zeta" }, result.Select(tag => tag.Name));
        Assert.Equal(2, result[0].RecipeCount);
        Assert.Equal("popular", Assert.Single((await HttpClient.GetFromJsonAsync<RecipeTagSummaryDto[]>("/api/recipes/tags?search=pop", JsonOptions))!).Name);
        using var anonymous = CreateUnauthenticatedApiClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/recipes/tags")).StatusCode);
    }

}
