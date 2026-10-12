namespace MealManager.Application.DTO;

public record AddMealGroceriesDto
{
    public required ICollection<AddGroceryItemDto> Groceries { get; init; } = [];
}
