namespace MealManager.Application.DTO;

public record RecipeProfileProductDto
{
    public required Guid Id { get; init; }
    public required string Name { get; init; }
    public required int Quantity { get; init; }
    public required bool AtHome { get; init; }
    public int Order { get; init; }
}
