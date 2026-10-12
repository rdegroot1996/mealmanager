namespace MealManager.Application.DTO;

public record AddGroceryItemDto
{
    public Guid? RecipeProfileProductId { get; init; }
    public required string Name { get; init; }
    public required int Quantity { get; init; }
}
