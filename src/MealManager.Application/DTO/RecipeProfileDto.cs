namespace MealManager.Application.DTO;

public record RecipeProfileDto
{
    public required Guid Id { get; init; }
    public required string Name { get; init; }
    public required int Servings { get; init; }
    public required ICollection<RecipeProfileProductDto> Products { get; init; }
}
