namespace MealManager.Application.DTO;

public record RecipeIngredientInputDto
{
    public Guid Id { get; init; }
    public required string Name { get; init; }
    public decimal? Quantity { get; init; }
    public string? QuantityText { get; init; }
    public string Unit { get; init; } = string.Empty;
}
