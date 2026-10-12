namespace MealManager.Application.Validators;

public class MovePlanningEntryDtoValidator : AbstractValidator<MovePlanningEntryDto>
{
    public MovePlanningEntryDtoValidator()
    {
        RuleFor(x => x.TargetDate).NotEmpty();
    }
}
