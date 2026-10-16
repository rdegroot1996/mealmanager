using System.ComponentModel;

namespace MealManager.Application.DTO.Mcp;

public sealed record PlanningDayNoteInputDto
{
    [Description("Existing note ID to retain or edit. Omit for a new note.")]
    public Guid? Id { get; init; }
    [Description("Unique temporary key required for a new note.")]
    public string? ClientKey { get; init; }
    public required DateOnly Date { get; init; }
    public required string Text { get; init; }
}
