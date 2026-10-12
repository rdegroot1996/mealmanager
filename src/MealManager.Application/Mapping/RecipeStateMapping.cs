using System.Globalization;
using System.Security.Cryptography;
using System.Text.Json;

namespace MealManager.Application.Mapping;

public static class RecipeStateMapping
{
    private static string Version(object value) => Convert.ToHexString(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(value)));

    public static RecipeStateDto ToState(this RecipeDto recipe) => new()
    {
        Id = recipe.Id,
        Name = recipe.Name,
        Notes = recipe.Notes,
        Category = recipe.Category,
        BaseServings = recipe.BaseServings,
        IsFavorite = recipe.IsFavorite,
        Images = recipe.Images,
        Tags = recipe.Tags,
        Ingredients = recipe.Ingredients,
        Steps = recipe.Steps,
        Profiles = recipe.Profiles,
        PlanningStatistics = (recipe as RecipeDetailsDto)?.PlanningStatistics,
        RecipeVersion = Version(new
        {
            recipe.Id,
            recipe.Name,
            recipe.Notes,
            recipe.Category,
            recipe.BaseServings,
            Tags = recipe.Tags.Select(tag => tag.Name).Order(StringComparer.Ordinal),
            Ingredients = recipe.Ingredients.OrderBy(row => row.Order).ThenBy(row => row.Id)
                .Select(row => new { row.Id, row.Name, Quantity = row.Quantity.ToString("G29", CultureInfo.InvariantCulture), row.Unit, row.Order }),
            Steps = recipe.Steps.OrderBy(row => row.Order).ThenBy(row => row.Id),
        }),
    };

    public static RecipeProfileStateDto ToState(this RecipeProfileDto profile) => new()
    {
        Id = profile.Id,
        Name = profile.Name,
        Servings = profile.Servings,
        Products = profile.Products,
        ProfileVersion = Version(new
        {
            profile.Id,
            profile.Name,
            profile.Servings,
            Products = profile.Products.OrderBy(row => row.Order).ThenBy(row => row.Id)
        }),
    };
}
