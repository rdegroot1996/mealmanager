namespace MealManager.Application.Validators.Mcp;

public sealed class CreateCycleMealPlanDtoValidator : AbstractValidator<CreateCycleMealPlanDto>
{
    public CreateCycleMealPlanDtoValidator()
    {
        RuleFor(command => command.EndDate).GreaterThanOrEqualTo(command => command.StartDate);
        RuleFor(command => command).Must(command => (command.Entries is null) == (command.Notes is null))
            .WithMessage("Supply both entries and notes, or omit both to create an empty cycle.");
        RuleFor(command => command.ExpectedMealPlanVersion).NotEmpty().When(command => command.Entries is not null);
        RuleForEach(command => command.Entries).NotNull().SetValidator(new PlannedEntryInputDtoValidator());
        RuleForEach(command => command.Notes).NotNull().SetValidator(new PlanningDayNoteInputDtoValidator());
    }
}
