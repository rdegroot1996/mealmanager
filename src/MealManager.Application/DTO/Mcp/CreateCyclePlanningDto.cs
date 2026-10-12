namespace MealManager.Application.DTO.Mcp;

public sealed record CreateCyclePlanningDto
{
    public required DateOnly StartDate { get; init; }
    public required DateOnly EndDate { get; init; }
    public string? ExpectedPlanningVersion { get; init; }
    public PlanningEntryInputDto[]? Entries { get; init; }
    public PlanningNoteInputDto[]? Notes { get; init; }
}
