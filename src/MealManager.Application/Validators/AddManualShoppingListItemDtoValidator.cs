namespace MealManager.Application.Validators;

public class AddManualShoppingListItemDtoValidator : AbstractValidator<AddManualShoppingListItemDto>
{
    public AddManualShoppingListItemDtoValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Quantity).GreaterThan(0);
    }
}
