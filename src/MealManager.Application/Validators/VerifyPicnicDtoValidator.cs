namespace MealManager.Application.Validators;

public sealed class VerifyPicnicDtoValidator : AbstractValidator<VerifyPicnicDto>
{
    public VerifyPicnicDtoValidator() => RuleFor(x => x.Code).NotEmpty().Matches("^[0-9]{4,12}$");
}
