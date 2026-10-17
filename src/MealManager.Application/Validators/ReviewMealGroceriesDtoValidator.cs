namespace MealManager.Application.Validators;

public class ReviewMealGroceriesDtoValidator : AbstractValidator<ReviewMealGroceriesDto>
{
    public ReviewMealGroceriesDtoValidator()
    {
        RuleForEach(x => x.Groceries).SetValidator(new AddShoppingListItemDtoValidator());
    }
}

public class AddShoppingListItemDtoValidator : AbstractValidator<AddShoppingListItemDto>
{
    public AddShoppingListItemDtoValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Quantity).GreaterThan(0);
    }
}
