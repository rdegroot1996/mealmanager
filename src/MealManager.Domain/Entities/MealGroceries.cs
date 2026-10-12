namespace MealManager.Domain.Entities;

public class MealGroceries : BaseEntity
{
    public required Guid PlanningMealId { get; set; }
    public PlanningMeal PlanningMeal { get; set; } = null!;
}
