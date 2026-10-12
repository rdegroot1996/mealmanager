namespace MealManager.Domain.Entities;

public class RecipeImage : BaseEntity
{
    public required Guid RecipeId { get; set; }
    public Recipe Recipe { get; set; } = null!;
    public required string RelativePath { get; set; }
    public required string ContentType { get; set; }
    public required int Order { get; set; }
}
