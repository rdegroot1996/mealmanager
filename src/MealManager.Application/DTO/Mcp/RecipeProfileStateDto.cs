namespace MealManager.Application.DTO.Mcp;

public sealed record RecipeProfileStateDto : RecipeProfileDto
{
    public required string ProfileVersion { get; init; }
}
