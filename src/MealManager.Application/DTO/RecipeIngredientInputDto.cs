namespace MealManager.Application.DTO;

public record RecipeIngredientInputDto
{
    public Guid Id { get; init; }
    public required string Name { get; init; }
    public required decimal Quantity { get; init; }
    public required string Unit { get; init; }
}
