namespace MealManager.Application.DTO;

public record UpdatePlanningCycleDto
{
    public required DateOnly StartDate { get; init; }
    public required DateOnly EndDate { get; init; }
}
