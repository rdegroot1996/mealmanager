namespace MealManager.Domain.Entities;

public class RecipeStep : BaseEntity
{
    public required Guid RecipeId { get; set; }
    public Recipe Recipe { get; set; } = null!;
    public required string Description { get; set; }
    public required int Order { get; set; }
}
