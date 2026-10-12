namespace MealManager.Application.Validators.Mcp;

public sealed class ApplyPlanningDtoValidator : AbstractValidator<ApplyPlanningDto>
{
    public ApplyPlanningDtoValidator()
    {
        RuleFor(command => command.CycleId).NotEmpty();
        RuleFor(command => command.ExpectedPlanningVersion).NotEmpty();
        RuleFor(command => command.Entries).NotNull();
        RuleFor(command => command.Notes).NotNull();
        RuleForEach(command => command.Entries).NotNull().SetValidator(new PlanningEntryInputDtoValidator());
        RuleForEach(command => command.Notes).NotNull().SetValidator(new PlanningNoteInputDtoValidator());
    }
}
