namespace MealManager.Api.Mcp.Contracts;

public sealed record McpRecipeIngredientInput
{
    public required string Name { get; init; }
    public required decimal Quantity { get; init; }
    public required string Unit { get; init; }
}
