namespace MealManager.Application.DTO.Mcp;

public sealed record MealPlanStateDto
{
    public PlanningCycleDto? Cycle { get; init; }
    public MealPlanDto? MealPlan { get; init; }
    public required string MealPlanVersion { get; init; }
    public IReadOnlyDictionary<string, Guid> CreatedIds { get; init; } = new Dictionary<string, Guid>();
}
