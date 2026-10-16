namespace MealManager.Application.DTO;

public record MealPlanDto
{
    public required Guid Id { get; init; }
    public required Guid PlanningCycleId { get; init; }
    public required ICollection<PlannedEntryDto> Entries { get; init; }
    public required ICollection<PlanningDayNoteDto> Notes { get; init; }
}
