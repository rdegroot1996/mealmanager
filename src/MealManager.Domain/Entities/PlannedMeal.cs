namespace MealManager.Domain.Entities;

public class PlannedMeal : PlannedEntry
{
    public required Guid RecipeId { get; set; }
    public Recipe Recipe { get; set; } = null!;
    public required Guid RecipeProfileId { get; set; }
    public RecipeProfile RecipeProfile { get; set; } = null!;
    public MealGroceryReview? GroceryReview { get; set; }
    public List<PlannedLeftover> Leftovers { get; set; } = [];
}
