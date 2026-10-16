using MealManager.Common.Enums;

namespace MealManager.Application.DTO;

public record PlannedEntryDto
{
    public required Guid Id { get; init; }
    public required PlannedEntryKind Kind { get; init; }
    public required Guid? OriginalMealId { get; init; }
    public required DateOnly Date { get; init; }
    public required int SortOrder { get; init; }
    public required RecipeSummaryDto Recipe { get; init; }
    public required RecipeProfileSummaryDto RecipeProfile { get; init; }
    public required bool HasReviewedGroceries { get; init; }
}
