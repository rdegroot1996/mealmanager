namespace MealManager.Application.Validators.Mcp;

public sealed class CreateCyclePlanningDtoValidator : AbstractValidator<CreateCyclePlanningDto>
{
    public CreateCyclePlanningDtoValidator()
    {
        RuleFor(command => command.EndDate).GreaterThanOrEqualTo(command => command.StartDate);
        RuleFor(command => command).Must(command => (command.Entries is null) == (command.Notes is null))
            .WithMessage("Supply both entries and notes, or omit both to create an empty cycle.");
        RuleFor(command => command.ExpectedPlanningVersion).NotEmpty().When(command => command.Entries is not null);
        RuleForEach(command => command.Entries).NotNull().SetValidator(new PlanningEntryInputDtoValidator());
        RuleForEach(command => command.Notes).NotNull().SetValidator(new PlanningNoteInputDtoValidator());
    }
}
