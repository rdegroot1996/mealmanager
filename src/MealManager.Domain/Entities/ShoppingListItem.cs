namespace MealManager.Domain.Entities;

public class ShoppingListItem : BaseEntity
{
    public required Guid ShoppingListId { get; set; }
    public ShoppingList ShoppingList { get; set; } = null!;
    public required string Name { get; set; }
    public required int Quantity { get; set; }
    public required int Order { get; set; }
    public bool Checked { get; set; } = false;
    public Guid? RecipeProfileGroceryItemId { get; set; }
    public RecipeProfileGroceryItem? RecipeProfileGroceryItem { get; set; }
    public Guid? PlannedMealId { get; set; }
    public PlannedMeal? PlannedMeal { get; set; }
}
