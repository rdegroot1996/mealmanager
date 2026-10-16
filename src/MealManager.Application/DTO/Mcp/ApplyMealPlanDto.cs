namespace MealManager.Application.DTO.Mcp;

public sealed record ApplyMealPlanDto
{
    public required Guid CycleId { get; init; }
    public required string ExpectedMealPlanVersion { get; init; }
    public required PlannedEntryInputDto[] Entries { get; init; }
    public required PlanningDayNoteInputDto[] Notes { get; init; }
}
