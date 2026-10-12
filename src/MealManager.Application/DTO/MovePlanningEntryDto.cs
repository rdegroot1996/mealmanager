namespace MealManager.Application.DTO;

public record MovePlanningEntryDto
{
    public required DateOnly TargetDate { get; init; }
    public int? TargetIndex { get; init; }
}
