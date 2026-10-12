namespace MealManager.Application.Validators;

public class AddPlanningMealDtoValidator : AbstractValidator<AddPlanningMealDto>
{
    public AddPlanningMealDtoValidator()
    {
        RuleFor(x => x.PlanningId).NotEmpty();
        RuleFor(x => x.RecipeId).NotEmpty();
        RuleFor(x => x.RecipeProfileId).NotEmpty();
    }
}
