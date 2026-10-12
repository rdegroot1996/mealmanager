namespace MealManager.Domain.Entities;

public class RecipeTag : BaseEntity
{
    public required Guid RecipeId { get; set; }
    public Recipe Recipe { get; set; } = null!;
    public required string Name { get; set; }
}
