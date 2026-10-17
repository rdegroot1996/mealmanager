namespace MealManager.Application.Validators;

public class AddPlannedMealDtoValidator : AbstractValidator<AddPlannedMealDto>
{
    public AddPlannedMealDtoValidator()
    {
        RuleFor(x => x.MealPlanId).NotEmpty();
        RuleFor(x => x.RecipeId).NotEmpty();
        RuleFor(x => x.RecipeProfileId).NotEmpty();
    }
}
