namespace MealManager.Application.DTO.Mcp;

public sealed record RecipeTagPageDto
{
    public required ICollection<RecipeTagSummaryDto> Tags { get; init; }
    public string? NextCursor { get; init; }
    public required int TotalCount { get; init; }
}
