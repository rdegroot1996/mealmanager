namespace MealManager.Domain.Entities;

public class GroceryList : BaseEntity
{
    public required Guid PlanningCycleId { get; set; }
    public PlanningCycle PlanningCycle { get; set; } = null!;
    public List<GroceryItem> Groceries { get; set; } = [];
}
