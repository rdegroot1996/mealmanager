namespace MealManager.Application.DTO;

public record PlanningNoteDto
{
    public required Guid Id { get; init; }
    public required DateOnly Date { get; init; }
    public required string Text { get; init; }
}
