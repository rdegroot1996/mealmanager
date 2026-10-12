using MealManager.Common.Enums;

namespace MealManager.Application.DTO.Mcp;

public sealed record RecipeCatalogOptions
{
    public string? Cursor { get; init; }
    public int PageSize { get; init; } = 50;
    public RecipeCategory? Category { get; init; }
    public string[] Tags { get; init; } = [];
    public bool? Favorite { get; init; }
}
