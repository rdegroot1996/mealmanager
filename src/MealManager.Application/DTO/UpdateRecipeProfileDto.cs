namespace MealManager.Application.DTO;

public record UpdateRecipeProfileDto
{
    public required string Name { get; init; }
    public required int Servings { get; init; }
    public required ICollection<RecipeProfileProductInputDto> Products { get; init; }
}
