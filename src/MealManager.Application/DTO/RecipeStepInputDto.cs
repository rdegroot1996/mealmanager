namespace MealManager.Application.DTO;

public record RecipeStepInputDto
{
    public Guid Id { get; init; }
    public required string Description { get; init; }
}
