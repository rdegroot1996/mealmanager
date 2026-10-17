namespace MealManager.Application.DTO;

public record AddRecipeProfileDto
{
    public required Guid RecipeId { get; init; }
    public required string Name { get; init; }
    public required int Servings { get; init; }
    public ICollection<RecipeProfileGroceryItemInputDto> Groceries { get; init; } = [];
}
