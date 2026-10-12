namespace MealManager.Application.DTO.Mcp;

public sealed record RecentPlanningCycleDto
{
    public required Guid Id { get; init; }
    public required DateOnly StartDate { get; init; }
    public required DateOnly EndDate { get; init; }
    public required ICollection<PlanningEntryDto> Entries { get; init; }
    public required ICollection<PlanningNoteDto> Notes { get; init; }
}
