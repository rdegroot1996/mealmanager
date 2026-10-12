namespace MealManager.Domain.Entities;

public class GroceryItem : BaseEntity
{
    public required Guid GroceryListId { get; set; }
    public GroceryList GroceryList { get; set; } = null!;
    public required string Name { get; set; }
    public required int Quantity { get; set; }
    public required int Order { get; set; }
    public bool Checked { get; set; } = false;
    public Guid? RecipeProfileProductId { get; set; }
    public RecipeProfileProduct? RecipeProfileProduct { get; set; }
    public Guid? PlanningMealId { get; set; }
    public PlanningMeal? PlanningMeal { get; set; }
}
