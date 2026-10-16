namespace MealManager.Domain.Entities;

public class MealGroceryReview : BaseEntity
{
    public required Guid PlannedMealId { get; set; }
    public PlannedMeal PlannedMeal { get; set; } = null!;
}
