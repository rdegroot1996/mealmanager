using MealManager.Common.Enums;

namespace MealManager.Domain.Entities;

public class SupermarketProductMapping : BaseEntity
{
    public Guid RecipeProfileGroceryItemId { get; set; }
    public RecipeProfileGroceryItem RecipeProfileGroceryItem { get; set; } = null!;
    public SupermarketProvider Provider { get; set; }
    public required string ProductId { get; set; }
    public required string ProductName { get; set; }
    public required string Pack { get; set; }
}
