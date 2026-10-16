namespace MealManager.Application.DTO.Mcp;

public sealed record CreateCycleMealPlanDto
{
    public required DateOnly StartDate { get; init; }
    public required DateOnly EndDate { get; init; }
    public string? ExpectedMealPlanVersion { get; init; }
    public PlannedEntryInputDto[]? Entries { get; init; }
    public PlanningDayNoteInputDto[]? Notes { get; init; }
}
