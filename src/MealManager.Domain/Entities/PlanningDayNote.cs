namespace MealManager.Domain.Entities;

public class PlanningDayNote : BaseEntity
{
    public required Guid MealPlanId { get; set; }
    public MealPlan MealPlan { get; set; } = null!;
    public required DateOnly Date { get; set; }
    public required string Text { get; set; }
}
