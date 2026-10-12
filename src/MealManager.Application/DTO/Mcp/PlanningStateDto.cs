namespace MealManager.Application.DTO.Mcp;

public sealed record PlanningStateDto
{
    public PlanningCycleDto? Cycle { get; init; }
    public PlanningDto? Planning { get; init; }
    public required string PlanningVersion { get; init; }
    public IReadOnlyDictionary<string, Guid> CreatedIds { get; init; } = new Dictionary<string, Guid>();
}
