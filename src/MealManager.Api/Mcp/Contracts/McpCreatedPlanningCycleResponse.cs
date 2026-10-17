namespace MealManager.Api.Mcp.Contracts;

public sealed record McpCreatedPlanningCycleResponse : PlanningCycleDto
{
    public required MealPlanDto MealPlan { get; init; }
    public required string MealPlanVersion { get; init; }
    public required IReadOnlyDictionary<string, Guid> CreatedIds { get; init; }
}
