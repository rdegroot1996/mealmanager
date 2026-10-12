namespace MealManager.Application.DTO.Mcp;

public sealed record RecipeCatalogPageDto
{
    public required ICollection<RecipeCatalogItemDto> Recipes { get; init; }
    public string? NextCursor { get; init; }
    public required int TotalCount { get; init; }
}
