namespace MealManager.Application.DTO;

public record SupermarketSelectionDto
{
    public required Guid ShoppingListItemId { get; init; }
    public required string ProductId { get; init; }
    public required int Quantity { get; init; }
    public required bool Remember { get; init; }
}
