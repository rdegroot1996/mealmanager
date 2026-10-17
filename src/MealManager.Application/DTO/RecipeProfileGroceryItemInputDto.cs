namespace MealManager.Application.DTO;

public record RecipeProfileGroceryItemInputDto
{
    public Guid Id { get; init; }
    public required string Name { get; init; }
    public required int Quantity { get; init; }
    public required bool AtHome { get; init; }
}
