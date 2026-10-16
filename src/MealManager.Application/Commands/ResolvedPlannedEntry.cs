namespace MealManager.Application.Commands;

internal sealed class ResolvedPlannedEntry(PlannedEntryInputDto input, Guid id)
{
    public PlannedEntryInputDto Input { get; } = input;
    public Guid Id { get; } = id;
    public Guid? OriginalMealId { get; set; }
}
