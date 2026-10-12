namespace MealManager.Application.DTO;

public record AddPlanningMealDto
{
    public required Guid PlanningId { get; init; }
    public required Guid RecipeId { get; init; }
    public required Guid RecipeProfileId { get; init; }
    public required DateOnly Date { get; init; }
}
