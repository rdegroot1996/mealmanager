namespace MealManager.Application.Validators;

public class UpdatePlanningCycleDtoValidator : AbstractValidator<UpdatePlanningCycleDto>
{
    public UpdatePlanningCycleDtoValidator()
    {
        RuleFor(x => x.EndDate).GreaterThanOrEqualTo(x => x.StartDate)
            .WithMessage("'End Date' must be greater than or equal to 'Start Date'.");
    }
}
