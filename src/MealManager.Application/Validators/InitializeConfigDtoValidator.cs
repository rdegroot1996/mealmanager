namespace MealManager.Application.Validators;

public class InitializeConfigDtoValidator : AbstractValidator<InitializeConfigDto>
{
    public InitializeConfigDtoValidator()
    {
        RuleFor(x => x.AdminEmail).NotEmpty().EmailAddress();
        RuleFor(x => x.AdminPassword).NotEmpty().MinimumLength(6);
        RuleFor(x => x.AdminDisplayName).NotEmpty();
    }
}
