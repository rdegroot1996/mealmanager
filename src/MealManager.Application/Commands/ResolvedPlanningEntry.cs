namespace MealManager.Application.Commands;

internal sealed class ResolvedPlanningEntry(PlanningEntryInputDto input, Guid id)
{
    public PlanningEntryInputDto Input { get; } = input;
    public Guid Id { get; } = id;
    public Guid? OriginalMealId { get; set; }
}
