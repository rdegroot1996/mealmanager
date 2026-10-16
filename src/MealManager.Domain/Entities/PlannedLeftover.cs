namespace MealManager.Domain.Entities;

public class PlannedLeftover : PlannedEntry
{
    public required Guid OriginalMealId { get; set; }
    public PlannedMeal OriginalMeal { get; set; } = null!;
}
