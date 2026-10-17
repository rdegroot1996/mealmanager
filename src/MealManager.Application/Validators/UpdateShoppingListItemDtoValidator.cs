using FluentValidation;

namespace MealManager.Application.Validators;

public class UpdateShoppingListItemDtoValidator : AbstractValidator<UpdateShoppingListItemDto>
{
    public UpdateShoppingListItemDtoValidator()
    {
        RuleFor(command => command.Name).NotEmpty().MaximumLength(200);
        RuleFor(command => command.Quantity).GreaterThan(0);
    }
}
