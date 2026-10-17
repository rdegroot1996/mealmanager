namespace MealManager.Application.DTO;

public record MovePlannedEntryDto
{
    public required DateOnly TargetDate { get; init; }
    public int? TargetIndex { get; init; }
}
