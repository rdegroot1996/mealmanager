namespace MealManager.Application.DTO;

public sealed record UpcomingPlanningDto
{
    public required DateOnly FromDate { get; init; }
    public required DateOnly[] PlannedDates { get; init; }
    public required ICollection<PlanningEntryDto> Entries { get; init; }
}
