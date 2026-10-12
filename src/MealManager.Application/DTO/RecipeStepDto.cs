namespace MealManager.Application.DTO;

public record RecipeStepDto
{
    public required Guid Id { get; init; }
    public required string Description { get; init; }
    public required int Order { get; init; }
}
