using MealManager.Common.Enums;

namespace MealManager.Application.DTO;

public record SupermarketConnectionDto
{
    public required SupermarketProvider Provider { get; init; }
    public required string Name { get; init; }
    public required string Status { get; init; }
    public required string? AccountLabel { get; init; }
}
