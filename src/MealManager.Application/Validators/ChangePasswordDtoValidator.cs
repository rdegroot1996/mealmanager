namespace MealManager.Application.Validators;

public class ChangePasswordDtoValidator : AbstractValidator<ChangePasswordDto>
{
    public ChangePasswordDtoValidator()
    {
        RuleFor(command => command.CurrentPassword).NotEmpty();
        RuleFor(command => command.NewPassword).NotEmpty().MinimumLength(6).NotEqual(command => command.CurrentPassword);
    }
}
