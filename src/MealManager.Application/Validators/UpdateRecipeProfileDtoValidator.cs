namespace MealManager.Application.Validators;

public class UpdateRecipeProfileDtoValidator : AbstractValidator<UpdateRecipeProfileDto>
{
    public UpdateRecipeProfileDtoValidator()
    {
        RuleFor(x => x.Name).NotEmpty();
        RuleFor(x => x.Servings).GreaterThan(0);
        RuleFor(x => x.Groceries).NotNull()
            .Must(rows => rows is null || rows.Where(row => row.Id != Guid.Empty).Select(row => row.Id).Distinct().Count() == rows.Count(row => row.Id != Guid.Empty))
            .WithMessage("Row IDs must be unique.");
        RuleForEach(x => x.Groceries).ChildRules(p =>
        {
            p.RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
            p.RuleFor(x => x.Quantity).GreaterThan(0);
        });
    }
}
