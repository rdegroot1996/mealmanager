namespace MealManager.Application.DTO.Mcp;

public sealed record RecentPlanningCyclesDto
{
    public required ICollection<RecentPlanningCycleDto> Cycles { get; init; }
    public DateOnly? NextBeforeStartDate { get; init; }
}
