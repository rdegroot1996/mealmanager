namespace MealManager.Domain.Entities;

public class PlanningNote : BaseEntity
{
    public required Guid PlanningId { get; set; }
    public Planning Planning { get; set; } = null!;
    public required DateOnly Date { get; set; }
    public required string Text { get; set; }
}
