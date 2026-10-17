namespace MealManager.Application.DTO;

public record AddPlanningDayNoteDto
{
    public required Guid MealPlanId { get; init; }
    public required DateOnly Date { get; init; }
    public required string Text { get; init; }
}
