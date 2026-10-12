using MealManager.Common.Enums;

namespace MealManager.Application.DTO;

public record PlanningEntryDto
{
    public required Guid Id { get; init; }
    public required PlanningEntryKind Kind { get; init; }
    public required Guid? OriginalMealId { get; init; }
    public required DateOnly Date { get; init; }
    public required int SortOrder { get; init; }
    public required RecipeSummaryDto Recipe { get; init; }
    public required RecipeProfileSummaryDto RecipeProfile { get; init; }
    public required bool HasGroceriesAdded { get; init; }
}
