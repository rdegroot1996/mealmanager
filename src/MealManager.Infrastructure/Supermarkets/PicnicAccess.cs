namespace MealManager.Infrastructure.Supermarkets;

public sealed class PicnicAccess(string token, string countryCode)
{
    public string Token { get; set; } = token;
    public string CountryCode { get; } = countryCode;
}
