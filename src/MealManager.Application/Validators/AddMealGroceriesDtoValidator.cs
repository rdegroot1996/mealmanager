namespace MealManager.Application.Validators;

public class AddMealGroceriesDtoValidator : AbstractValidator<AddMealGroceriesDto>
{
    public AddMealGroceriesDtoValidator()
    {
        RuleForEach(x => x.Groceries).SetValidator(new AddGroceryItemDtoValidator());
    }
}

public class AddGroceryItemDtoValidator : AbstractValidator<AddGroceryItemDto>
{
    public AddGroceryItemDtoValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Quantity).GreaterThan(0);
    }
}
