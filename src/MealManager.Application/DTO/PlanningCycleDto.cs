namespace MealManager.Application.DTO;

public record PlanningCycleDto
{
    public required Guid Id { get; init; }
    public required DateOnly StartDate { get; init; }
    public required DateOnly EndDate { get; init; }
    public required Guid? PreviousPlanningCycleId { get; init; }
    public required Guid? NextPlanningCycleId { get; init; }
}
