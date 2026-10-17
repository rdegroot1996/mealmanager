namespace MealManager.Application.Validators;

public class AddRecipeProfileDtoValidator : AbstractValidator<AddRecipeProfileDto>
{
    public AddRecipeProfileDtoValidator()
    {
        RuleFor(x => x.RecipeId).NotEmpty();
        RuleFor(x => x.Name).NotEmpty();
        RuleFor(x => x.Servings).GreaterThan(0);
        RuleForEach(x => x.Groceries).ChildRules(item =>
        {
            item.RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
            item.RuleFor(x => x.Quantity).GreaterThan(0);
        });
    }
}
