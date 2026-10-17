namespace MealManager.Application.DTO;

public record AddShoppingListItemDto
{
    public Guid? RecipeProfileGroceryItemId { get; init; }
    public required string Name { get; init; }
    public required int Quantity { get; init; }
}
