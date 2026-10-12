namespace MealManager.Application.DTO.Mcp;

public sealed class RecipeStateDto : RecipeDto
{
    public required string RecipeVersion { get; init; }
    public RecipePlanningStatisticsDto? PlanningStatistics { get; init; }
}
