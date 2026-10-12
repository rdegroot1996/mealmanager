namespace MealManager.Application.Validators;

public class UpdateRecipeImageOrderDtoValidator : AbstractValidator<UpdateRecipeImageOrderDto>
{
    public UpdateRecipeImageOrderDtoValidator()
    {
        RuleFor(x => x.ImageIds).NotNull();
        RuleForEach(x => x.ImageIds).NotEmpty();
    }
}
