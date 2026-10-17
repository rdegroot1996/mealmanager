namespace MealManager.Application.DTO;

public record MealShoppingGroupDto
{
    public required PlannedMealSummaryDto Meal { get; init; }
    public required ICollection<ShoppingListItemDto> Items { get; init; }
}
