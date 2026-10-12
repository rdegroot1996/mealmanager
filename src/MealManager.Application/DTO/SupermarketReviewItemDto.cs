using MealManager.Domain.Contracts;

namespace MealManager.Application.DTO;

public record SupermarketReviewItemDto
{
    public required Guid GroceryItemId { get; init; }
    public required Guid? ProfileProductId { get; init; }
    public required string Name { get; init; }
    public required int Quantity { get; init; }
    public required bool Checked { get; init; }
    public required string Group { get; init; }
    public required SupermarketProduct? Product { get; init; }
}
