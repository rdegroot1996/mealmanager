using MealManager.Common.Enums;

namespace MealManager.Application.DTO;

public class RecipeDto
{
    public required Guid Id { get; init; }
    public required string Name { get; init; }
    public string? Notes { get; init; }
    public required RecipeCategory Category { get; init; }
    public required int BaseServings { get; init; }
    public required bool IsFavorite { get; init; }

    public required ICollection<RecipeTagDto> Tags { get; init; }
    public required ICollection<RecipeImageDto> Images { get; init; }

    public required ICollection<RecipeIngredientDto> Ingredients { get; init; }
    public required ICollection<RecipeStepDto> Steps { get; init; }
    public required ICollection<RecipeProfileSummaryDto> Profiles { get; init; }
}
