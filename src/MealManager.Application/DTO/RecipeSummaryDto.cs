using MealManager.Common.Enums;

namespace MealManager.Application.DTO;

public record RecipeSummaryDto
{
    public required Guid Id { get; init; }
    public required string Name { get; init; }
    public required RecipeCategory Category { get; init; }
    public required ICollection<RecipeTagDto> Tags { get; init; }
    public required string? ImageUrl { get; init; }
    public required bool IsFavorite { get; init; }
}
