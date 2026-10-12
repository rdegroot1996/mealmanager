using MealManager.Common.Enums;

namespace MealManager.Application.DTO;

public record SupermarketReviewDto
{
    public required SupermarketProvider Provider { get; init; }
    public required string AccountId { get; init; }
    public required Guid ConnectionGeneration { get; init; }
    public required string Revision { get; init; }
    public required IReadOnlyList<SupermarketReviewItemDto> Items { get; init; }
    public required int UnreviewedMeals { get; init; }
}
