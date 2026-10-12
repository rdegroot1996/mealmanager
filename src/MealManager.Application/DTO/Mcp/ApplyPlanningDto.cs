namespace MealManager.Application.DTO.Mcp;

public sealed record ApplyPlanningDto
{
    public required Guid CycleId { get; init; }
    public required string ExpectedPlanningVersion { get; init; }
    public required PlanningEntryInputDto[] Entries { get; init; }
    public required PlanningNoteInputDto[] Notes { get; init; }
}
