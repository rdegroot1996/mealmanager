namespace MealManager.Api.Mcp.Contracts;

public sealed record McpShoppingListItemInput
{
    public Guid? RecipeProfileGroceryItemId { get; init; }
    public required string Name { get; init; }
    public required int Quantity { get; init; }
}
