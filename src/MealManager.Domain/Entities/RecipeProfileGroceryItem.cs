namespace MealManager.Domain.Entities;

public class RecipeProfileGroceryItem : BaseEntity
{
    public required Guid RecipeProfileId { get; set; }
    public RecipeProfile RecipeProfile { get; set; } = null!;
    public required string Name { get; set; }
    public required int Quantity { get; set; }
    public required bool AtHome { get; set; }
    public int Order { get; set; }
}
