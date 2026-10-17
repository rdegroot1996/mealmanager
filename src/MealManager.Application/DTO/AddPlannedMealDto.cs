namespace MealManager.Application.DTO;

public record AddPlannedMealDto
{
    public required Guid MealPlanId { get; init; }
    public required Guid RecipeId { get; init; }
    public required Guid RecipeProfileId { get; init; }
    public required DateOnly Date { get; init; }
}
