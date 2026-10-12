namespace MealManager.Infrastructure.Supermarkets;

public static class PicnicProtocol
{
    public const string ApiVersion = "15";
    public const string DeviceId = "3C417201548B2E3B";
    public const string Agent = "30100;1.246.1-15599;";
    public const int ClientId = 30100;
    public static readonly TimeSpan RequestTimeout = TimeSpan.FromSeconds(20);
    public static readonly TimeSpan VerificationLifetime = TimeSpan.FromMinutes(10);
    public static readonly TimeSpan CodeCooldown = TimeSpan.FromSeconds(30);
    public static bool ValidCountry(string country) => country is "NL" or "DE" or "FR";
    public static string Origin(string country) => $"https://storefront-prod.{country.ToLowerInvariant()}.picnicinternational.com";
    public static string Language(string country) => country.ToLowerInvariant();
}
