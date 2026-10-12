using MealManager.Common.Enums;

namespace MealManager.Application.DTO;

public record CreateRecipeDto
{
    public required string Name { get; init; }
    public string? Notes { get; init; }
    public required RecipeCategory Category { get; init; }
    public required int BaseServings { get; init; }
    public required ICollection<string> Tags { get; init; }
    public required ICollection<RecipeIngredientInputDto> Ingredients { get; init; }
    public required ICollection<RecipeStepInputDto> Steps { get; init; }
}
