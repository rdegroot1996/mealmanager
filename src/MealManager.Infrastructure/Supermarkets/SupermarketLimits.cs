namespace MealManager.Infrastructure.Supermarkets;

public static class SupermarketLimits
{
    public static readonly TimeSpan SendTimeout = TimeSpan.FromSeconds(60);
    public static readonly TimeSpan LocalSaveTimeout = TimeSpan.FromSeconds(5);
    public const int MaxSelections = 500;
    public const int MaxQuantity = 999;
}
