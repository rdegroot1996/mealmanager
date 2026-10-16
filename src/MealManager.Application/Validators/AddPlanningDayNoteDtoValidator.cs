namespace MealManager.Application.Validators;

public class AddPlanningDayNoteDtoValidator : AbstractValidator<AddPlanningDayNoteDto>
{
    public AddPlanningDayNoteDtoValidator()
    {
        RuleFor(x => x.MealPlanId).NotEmpty();
        RuleFor(x => x.Text).NotEmpty();
    }
}
