namespace MealManager.Application.DTO;

public record SupermarketSendLineDto
{
    public required string ProductId { get; init; }
    public required string ProductName { get; init; }
    public required string Pack { get; init; }
    public required int Quantity { get; init; }
    public required string Outcome { get; init; }
    public required string? Reason { get; init; }
    public required IReadOnlyList<Guid> GroceryItemIds { get; init; }
    public string? LocalWarning { get; init; }
}
