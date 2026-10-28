using MealManager.Common.Enums;

namespace MealManager.Application.DTO.Mcp;

public sealed record PatchRecipeDto
{
    public required Guid RecipeId { get; init; }
    public required string ExpectedRecipeVersion { get; init; }
    public string? Name { get; init; }
    public string? Notes { get; init; }
    public RecipeCategory? Category { get; init; }
    public int? BaseServings { get; init; }
    public string[]? Tags { get; init; }
    public RecipeIngredientInputDto[]? Ingredients { get; init; }
    public RecipeStepInputDto[]? Steps { get; init; }
}
