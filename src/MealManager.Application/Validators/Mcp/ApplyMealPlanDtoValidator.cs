namespace MealManager.Application.Validators.Mcp;

public sealed class ApplyMealPlanDtoValidator : AbstractValidator<ApplyMealPlanDto>
{
    public ApplyMealPlanDtoValidator()
    {
        RuleFor(command => command.CycleId).NotEmpty();
        RuleFor(command => command.ExpectedMealPlanVersion).NotEmpty();
        RuleFor(command => command.Entries).NotNull();
        RuleFor(command => command.Notes).NotNull();
        RuleForEach(command => command.Entries).NotNull().SetValidator(new PlannedEntryInputDtoValidator());
        RuleForEach(command => command.Notes).NotNull().SetValidator(new PlanningDayNoteInputDtoValidator());
    }
}
