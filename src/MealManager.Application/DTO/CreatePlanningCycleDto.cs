namespace MealManager.Application.DTO;

public record CreatePlanningCycleDto
{
    public required DateOnly StartDate { get; init; }
    public required DateOnly EndDate { get; init; }
}
