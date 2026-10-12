using MealManager.Common.Enums;

namespace MealManager.Application.DTO;

public record SendSupermarketDto
{
    public required SupermarketProvider Provider { get; init; }
    public required string AccountId { get; init; }
    public required Guid ConnectionGeneration { get; init; }
    public required string Revision { get; init; }
    public required List<SupermarketSelectionDto> Items { get; init; }
    public required List<SupermarketQuantityDto> Totals { get; init; }
}
