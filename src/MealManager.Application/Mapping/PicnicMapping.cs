using MealManager.Application.DTO;
using MealManager.Infrastructure.Supermarkets;
namespace MealManager.Application.Mapping;

public static class PicnicMapping
{
    public static PicnicConnectionDto ToDto(this PicnicSettings settings) => new()
    {
        Status = settings.Status == "VerificationRequired" && settings.VerificationExpiresAt <= DateTime.UtcNow
            ? "Disconnected" : settings.Status,
        AccountLabel = settings.AccountLabel,
        CountryCode = settings.CountryCode,
    };
}
