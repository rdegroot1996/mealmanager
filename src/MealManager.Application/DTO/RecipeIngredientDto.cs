namespace MealManager.Application.DTO;

public record RecipeIngredientDto
{
    public required Guid Id { get; init; }
    public required string Name { get; init; }
    public decimal? Quantity { get; init; }
    public string? QuantityText { get; init; }
    public required string Unit { get; init; }
    public int Order { get; init; }
}
