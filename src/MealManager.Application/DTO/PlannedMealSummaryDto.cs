namespace MealManager.Application.DTO;

public record PlannedMealSummaryDto
{
    public required Guid Id { get; init; }
    public required DateOnly Date { get; init; }
    public required Guid RecipeId { get; init; }
    public required string RecipeName { get; init; }
    public required string RecipeImageUrl { get; init; }
    public required Guid RecipeProfileId { get; init; }
    public required string ProfileName { get; init; }
    public required int ProfileServings { get; init; }
}
