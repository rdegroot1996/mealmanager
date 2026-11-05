namespace MealManager.Domain.Entities;

public class RecipeIngredient : BaseEntity
{
    public required Guid RecipeId { get; set; }
    public Recipe Recipe { get; set; } = null!;
    public required string Name { get; set; }
    public decimal? Quantity { get; set; }
    public string? QuantityText { get; set; }
    public string Unit { get; set; } = string.Empty;
    public required int Order { get; set; }
}
