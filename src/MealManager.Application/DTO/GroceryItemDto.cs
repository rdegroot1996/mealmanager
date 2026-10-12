using System.ComponentModel;

namespace MealManager.Application.DTO;

public record GroceryItemDto
{
    public required Guid Id { get; init; }
    public required string Name { get; init; }
    public required int Quantity { get; init; }
    public required int Order { get; init; }
    public required bool Checked { get; init; }
    public required Guid? RecipeProfileProductId { get; init; }
    [Description("Original planned-meal ID for a meal-group item; null for Other items. Find recipe and date in the corresponding planningMealGroceries group's planningMeal.")]
    public required Guid? PlanningMealId { get; init; }
}
