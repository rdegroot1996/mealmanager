namespace MealManager.Api.Mcp.Contracts;

public sealed record McpRecipeSearchResponse
{
    public required ICollection<RecipeSearchResultDto> Recipes { get; init; }
}
