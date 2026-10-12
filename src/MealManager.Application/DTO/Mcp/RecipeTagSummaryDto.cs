namespace MealManager.Application.DTO.Mcp;

public sealed record RecipeTagSummaryDto
{
    public required string Name { get; init; }
    public required int RecipeCount { get; init; }
}
