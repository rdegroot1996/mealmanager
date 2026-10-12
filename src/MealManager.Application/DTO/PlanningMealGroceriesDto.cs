namespace MealManager.Application.DTO;

public record PlanningMealGroceriesDto
{
    public required PlanningMealSummaryDto PlanningMeal { get; init; }
    public required ICollection<GroceryItemDto> Groceries { get; init; }
}
