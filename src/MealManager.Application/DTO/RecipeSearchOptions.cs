using MealManager.Common.Enums;

namespace MealManager.Application.DTO;

public sealed record RecipeSearchOptions
{
    public string? Search { get; init; }
    public RecipeCategory? Category { get; init; }
    public ICollection<string> Tags { get; init; } = [];
    public bool? Favorite { get; init; }
    public RecipeSearchSort Sort { get; init; } = RecipeSearchSort.Name;
    public int? Limit { get; init; } = 20;
}
