namespace MealManager.Api.Mcp.Contracts;

public sealed record McpRemovedGroceryResponse
{
    public required Guid ShoppingListItemId { get; init; }
    public bool Removed { get; init; } = true;
}
