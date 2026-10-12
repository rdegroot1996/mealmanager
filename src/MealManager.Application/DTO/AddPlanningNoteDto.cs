namespace MealManager.Application.DTO;

public record AddPlanningNoteDto
{
    public required Guid PlanningId { get; init; }
    public required DateOnly Date { get; init; }
    public required string Text { get; init; }
}
