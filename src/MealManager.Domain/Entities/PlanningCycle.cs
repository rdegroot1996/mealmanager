namespace MealManager.Domain.Entities;

public class PlanningCycle : BaseEntity
{
    public required DateOnly StartDate { get; set; }
    public required DateOnly EndDate { get; set; }
}
