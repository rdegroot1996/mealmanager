using MealManager.Common.Enums;

namespace MealManager.Application.DTO;

public record SupermarketSendDto
{
    public required Guid PlanningCycleId { get; init; }
    public required SupermarketProvider Provider { get; init; }
    public required string AccountId { get; init; }
    public required string AccountLabel { get; init; }
    public required Guid ConnectionGeneration { get; init; }
    public required IReadOnlyList<SupermarketSendLineDto> Lines { get; init; }
}
