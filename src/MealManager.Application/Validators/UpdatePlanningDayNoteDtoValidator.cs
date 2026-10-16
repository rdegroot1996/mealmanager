namespace MealManager.Application.Validators;

public class UpdatePlanningDayNoteDtoValidator : AbstractValidator<UpdatePlanningDayNoteDto>
{
    public UpdatePlanningDayNoteDtoValidator()
    {
        RuleFor(x => x.Text).NotEmpty();
    }
}
