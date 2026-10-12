using MealManager.Common.Enums;

namespace MealManager.Application.DTO;

public sealed record RecipeSearchResultDto
{
    public required Guid Id { get; init; }
    public required string Name { get; init; }
    public required RecipeCategory Category { get; init; }
    public required int BaseServings { get; init; }
    public required bool IsFavorite { get; init; }
    public required ICollection<RecipeTagDto> Tags { get; init; }
    public required string? ImageUrl { get; init; }
    public required ICollection<RecipeIngredientDto> Ingredients { get; init; }
    public required ICollection<RecipeProfileSummaryDto> Profiles { get; init; }
    public required int PastTimesPlanned { get; init; }
    public DateOnly? LastPastPlanned { get; init; }
    public int UpcomingTimesPlanned { get; init; }
}
