using System.Net.Http.Json;
using MealManager.Application.DTO;
using Xunit;

namespace MealManager.Tests.Integration.Tests;

public partial class RecipeControllerTests
{
    [Theory]
    [InlineData("tOmAtO", "Tomato Pasta")]
    [InlineData("éÉN", "Één pan")]
    [InlineData("  PASTA  ", "Tomato Pasta")]
    [InlineData("%_.*[", "Special %_.*[ dish")]
    public async Task Search_IsCaseInsensitiveAndTreatsSearchAsLiteralText(string search, string expected)
    {
        foreach (var name in new[] { "Tomato Pasta", "Één pan", "Special %_.*[ dish", "Other dish" })
            (await HttpClient.PostAsJsonAsync("/api/recipes", CreateTestRecipe(name))).EnsureSuccessStatusCode();
        var results = await HttpClient.GetFromJsonAsync<RecipeSummaryDto[]>(
            $"/api/recipes?search={Uri.EscapeDataString(search)}", JsonOptions);
        Assert.Equal(expected, Assert.Single(results!).Name);
    }
}
