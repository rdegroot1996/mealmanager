namespace MealManager.Domain.Entities;

public class MealPlan : BaseEntity
{
    public required Guid PlanningCycleId { get; set; }
    public PlanningCycle PlanningCycle { get; set; } = null!;
    public List<PlannedEntry> Entries { get; set; } = [];
    public List<PlanningDayNote> Notes { get; set; } = [];
}
