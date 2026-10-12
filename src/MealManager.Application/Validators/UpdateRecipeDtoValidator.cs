namespace MealManager.Application.Validators;

public class UpdateRecipeDtoValidator : AbstractValidator<UpdateRecipeDto>
{
    public UpdateRecipeDtoValidator()
    {
        RuleFor(x => x.Name).NotEmpty();
        RuleFor(x => x.Notes).MaximumLength(4000);
        RuleFor(x => x.Category).IsInEnum();
        RuleFor(x => x.BaseServings).GreaterThan(0);
        RuleFor(x => x.Tags).NotNull();
        RuleForEach(x => x.Tags).NotEmpty();
        RuleFor(x => x.Ingredients).NotNull()
            .Must(rows => rows is null || rows.Where(row => row.Id != Guid.Empty).Select(row => row.Id).Distinct().Count() == rows.Count(row => row.Id != Guid.Empty))
            .WithMessage("Row IDs must be unique.");
        RuleForEach(x => x.Ingredients).ChildRules(i =>
        {
            i.RuleFor(x => x.Name).NotEmpty();
            i.RuleFor(x => x.Quantity).GreaterThan(0);
            i.RuleFor(x => x.Unit).NotEmpty();
        });
        RuleFor(x => x.Steps).NotNull()
            .Must(rows => rows is null || rows.Where(row => row.Id != Guid.Empty).Select(row => row.Id).Distinct().Count() == rows.Count(row => row.Id != Guid.Empty))
            .WithMessage("Row IDs must be unique.");
        RuleForEach(x => x.Steps).ChildRules(s =>
        {
            s.RuleFor(x => x.Description).NotEmpty();
        });
    }
}
