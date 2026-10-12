namespace MealManager.Domain.Entities;

public class PlanningLeftover : PlanningEntry
{
    public required Guid OriginalMealId { get; set; }
    public PlanningMeal OriginalMeal { get; set; } = null!;
}
