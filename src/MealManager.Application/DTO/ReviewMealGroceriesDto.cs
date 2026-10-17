namespace MealManager.Application.DTO;

public record ReviewMealGroceriesDto
{
    public required ICollection<AddShoppingListItemDto> Groceries { get; init; } = [];
}
