namespace MealManager.Application.Validators;

public class MovePlannedEntryDtoValidator : AbstractValidator<MovePlannedEntryDto>
{
    public MovePlannedEntryDtoValidator()
    {
        RuleFor(x => x.TargetDate).NotEmpty();
    }
}
