namespace MealManager.Application.DTO;

public sealed record UpcomingMealPlanDto
{
    public required DateOnly FromDate { get; init; }
    public required DateOnly[] PlannedDates { get; init; }
    public required ICollection<PlannedEntryDto> Entries { get; init; }
}
