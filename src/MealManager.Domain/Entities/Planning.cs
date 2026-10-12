namespace MealManager.Domain.Entities;

public class Planning : BaseEntity
{
    public required Guid PlanningCycleId { get; set; }
    public PlanningCycle PlanningCycle { get; set; } = null!;
    public List<PlanningEntry> Entries { get; set; } = [];
    public List<PlanningNote> Notes { get; set; } = [];
}
