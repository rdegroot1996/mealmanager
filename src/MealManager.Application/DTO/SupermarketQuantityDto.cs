namespace MealManager.Application.DTO;

public record SupermarketQuantityDto
{
    public required string ProductId { get; init; }
    public required int Quantity { get; init; }
}
