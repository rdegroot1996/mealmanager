namespace MealManager.Application.Validators;

public class UpdateShoppingListItemOrderDtoValidator : AbstractValidator<UpdateShoppingListItemOrderDto>
{
    public UpdateShoppingListItemOrderDtoValidator()
    {
        RuleFor(x => x.ItemIds)
            .NotEmpty()
            .Must(ids => ids.Distinct().Count() == ids.Count)
            .WithMessage("Grocery item identifiers must be unique.");
    }
}
