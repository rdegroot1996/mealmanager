namespace MealManager.Application.Validators;

public class AddPlanningNoteDtoValidator : AbstractValidator<AddPlanningNoteDto>
{
    public AddPlanningNoteDtoValidator()
    {
        RuleFor(x => x.PlanningId).NotEmpty();
        RuleFor(x => x.Text).NotEmpty();
    }
}
