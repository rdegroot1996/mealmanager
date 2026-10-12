namespace MealManager.Application.DTO;

public record UpdatePlanningNoteDto
{
    public required string Text { get; init; }
}
