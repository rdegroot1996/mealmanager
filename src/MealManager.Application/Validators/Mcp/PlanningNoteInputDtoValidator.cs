namespace MealManager.Application.Validators.Mcp;

public sealed class PlanningNoteInputDtoValidator : AbstractValidator<PlanningNoteInputDto>
{
    public PlanningNoteInputDtoValidator()
    {
        RuleFor(note => note.Id).NotEmpty().When(note => note.Id.HasValue);
        RuleFor(note => note.ClientKey).NotEmpty().MaximumLength(100).When(note => !note.Id.HasValue);
        RuleFor(note => note.ClientKey).Null().When(note => note.Id.HasValue);
        RuleFor(note => note.Text).NotEmpty();
    }
}
