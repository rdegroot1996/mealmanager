namespace MealManager.Application.Validators;

public class CreateRecipeDtoValidator : AbstractValidator<CreateRecipeDto>
{
    public CreateRecipeDtoValidator()
    {
        RuleFor(x => x.Name).NotEmpty();
        RuleFor(x => x.Notes).MaximumLength(4000);
        RuleFor(x => x.Category).IsInEnum();
        RuleFor(x => x.BaseServings).GreaterThan(0);
        RuleFor(x => x.Tags).NotNull();
        RuleForEach(x => x.Tags).NotEmpty();
        RuleFor(x => x.Ingredients).NotNull();
        RuleForEach(x => x.Ingredients).ChildRules(i =>
        {
            i.RuleFor(x => x.Name).NotEmpty();
            i.RuleFor(x => x.Quantity).GreaterThan(0);
            i.RuleFor(x => x.QuantityText).MaximumLength(200)
                .Must((row, text) => string.IsNullOrWhiteSpace(text) || row.Quantity is null)
                .WithMessage("Use either a numeric quantity or a text amount.");
            i.RuleFor(x => x.Unit).NotNull();
        });
        RuleFor(x => x.Steps).NotNull();
        RuleForEach(x => x.Steps).ChildRules(s =>
        {
            s.RuleFor(x => x.Description).NotEmpty();
        });
    }
}
