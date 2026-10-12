namespace MealManager.Api.Mcp.Contracts;

public sealed record McpRemovedGroceryResponse
{
    public required Guid GroceryItemId { get; init; }
    public bool Removed { get; init; } = true;
}
