namespace MealManager.Application.Validators;

public class CreatePlanningCycleDtoValidator : AbstractValidator<CreatePlanningCycleDto>
{
    public CreatePlanningCycleDtoValidator()
    {
        RuleFor(x => x.EndDate).GreaterThanOrEqualTo(x => x.StartDate)
            .WithMessage("'End Date' must be greater than or equal to 'Start Date'.");
    }
}
