namespace MealManager.Application.DTO;

public record PlanningDto
{
    public required Guid Id { get; init; }
    public required Guid PlanningCycleId { get; init; }
    public required ICollection<PlanningEntryDto> Entries { get; init; }
    public required ICollection<PlanningNoteDto> Notes { get; init; }

    [System.Text.Json.Serialization.JsonIgnore]
    public ICollection<PlanningEntryDto> Meals =>
        Entries.Where(entry => entry.Kind == MealManager.Common.Enums.PlanningEntryKind.Meal).ToArray();

    [System.Text.Json.Serialization.JsonIgnore]
    public ICollection<PlanningEntryDto> Leftovers =>
        Entries.Where(entry => entry.Kind == MealManager.Common.Enums.PlanningEntryKind.Leftover).ToArray();
}
