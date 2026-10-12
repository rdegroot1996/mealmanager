namespace MealManager.Domain.Contracts;

public record SupermarketProduct(string Id, string Name, string Pack, int? PriceCents, string Currency, string? ImageUrl, ProductAvailability Availability, int? MaxQuantity);
