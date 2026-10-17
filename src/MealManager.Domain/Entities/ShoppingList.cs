namespace MealManager.Domain.Entities;

public class ShoppingList : BaseEntity
{
    public required Guid PlanningCycleId { get; set; }
    public PlanningCycle PlanningCycle { get; set; } = null!;
    public List<ShoppingListItem> Items { get; set; } = [];
}
