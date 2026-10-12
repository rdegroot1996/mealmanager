using MealManager.Infrastructure.Supermarkets;
namespace MealManager.Application.Validators;

public sealed class ConnectPicnicDtoValidator : AbstractValidator<ConnectPicnicDto>
{
    public ConnectPicnicDtoValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(254);
        RuleFor(x => x.Password).NotEmpty().MaximumLength(1024);
        RuleFor(x => x.CountryCode).Must(PicnicProtocol.ValidCountry);
    }
}
