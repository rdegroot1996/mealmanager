namespace MealManager.Application.Validators;

public class UpdateGroceryItemOrderDtoValidator : AbstractValidator<UpdateGroceryItemOrderDto>
{
    public UpdateGroceryItemOrderDtoValidator()
    {
        RuleFor(x => x.ItemIds)
            .NotEmpty()
            .Must(ids => ids.Distinct().Count() == ids.Count)
            .WithMessage("Grocery item identifiers must be unique.");
    }
}
