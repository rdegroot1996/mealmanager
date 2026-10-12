namespace MealManager.Api.Mcp.Contracts;

public sealed record McpGroceryItemInput
{
    public Guid? RecipeProfileProductId { get; init; }
    public required string Name { get; init; }
    public required int Quantity { get; init; }
}
