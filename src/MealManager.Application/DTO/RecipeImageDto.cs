namespace MealManager.Application.DTO;

public record RecipeImageDto
{
    public required Guid Id { get; init; }
    public required string Url { get; init; }
    public required int Order { get; init; }
}
