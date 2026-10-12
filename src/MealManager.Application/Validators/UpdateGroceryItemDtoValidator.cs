using FluentValidation;

namespace MealManager.Application.Validators;

public class UpdateGroceryItemDtoValidator : AbstractValidator<UpdateGroceryItemDto>
{
    public UpdateGroceryItemDtoValidator()
    {
        RuleFor(command => command.Name).NotEmpty().MaximumLength(200);
        RuleFor(command => command.Quantity).GreaterThan(0);
    }
}
