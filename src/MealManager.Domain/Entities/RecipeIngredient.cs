namespace MealManager.Domain.Entities;

public class RecipeIngredient : BaseEntity
{
    public required Guid RecipeId { get; set; }
    public Recipe Recipe { get; set; } = null!;
    public required string Name { get; set; }
    public required decimal Quantity { get; set; }
    public required string Unit { get; set; }
    public required int Order { get; set; }
}
