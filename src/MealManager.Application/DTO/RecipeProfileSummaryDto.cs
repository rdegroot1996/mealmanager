namespace MealManager.Application.DTO;

public record RecipeProfileSummaryDto
{
    public required Guid Id { get; init; }
    public required string Name { get; init; }
    public required int Servings { get; init; }
}
