namespace MealManager.Application.Validators;

public class UpdatePlanningNoteDtoValidator : AbstractValidator<UpdatePlanningNoteDto>
{
    public UpdatePlanningNoteDtoValidator()
    {
        RuleFor(x => x.Text).NotEmpty();
    }
}
