namespace MealManager.Application.Validators;

public class ResetUserPasswordDtoValidator : AbstractValidator<ResetUserPasswordDto>
{
    public ResetUserPasswordDtoValidator() => RuleFor(command => command.TemporaryPassword).NotEmpty().MinimumLength(6);
}
