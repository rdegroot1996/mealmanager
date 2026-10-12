namespace MealManager.Domain.Contracts;

public record SupermarketConnectionInfo(string Status, string? AccountId, string? AccountLabel, Guid Generation);
