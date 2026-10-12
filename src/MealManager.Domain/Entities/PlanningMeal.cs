namespace MealManager.Domain.Entities;

public class PlanningMeal : PlanningEntry
{
    public required Guid RecipeId { get; set; }
    public Recipe Recipe { get; set; } = null!;
    public required Guid RecipeProfileId { get; set; }
    public RecipeProfile RecipeProfile { get; set; } = null!;
    public MealGroceries? Groceries { get; set; }
    public List<PlanningLeftover> Leftovers { get; set; } = [];
}
