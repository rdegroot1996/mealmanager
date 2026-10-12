namespace MealManager.Api.Mcp.Contracts;

public sealed record McpCreatedPlanningCycleResponse : PlanningCycleDto
{
    public required PlanningDto Planning { get; init; }
    public required string PlanningVersion { get; init; }
    public required IReadOnlyDictionary<string, Guid> CreatedIds { get; init; }
}
