namespace MealManager.Application.DTO;

public class RecipeDetailsDto : RecipeDto
{
    public required RecipePlanningStatisticsDto PlanningStatistics { get; init; }
}
