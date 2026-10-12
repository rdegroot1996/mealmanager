namespace MealManager.Application.Validators;

public class AddManualGroceryItemDtoValidator : AbstractValidator<AddManualGroceryItemDto>
{
    public AddManualGroceryItemDtoValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Quantity).GreaterThan(0);
    }
}
