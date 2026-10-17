namespace MealManager.Application.DTO.Mcp;

public sealed record PatchRecipeProfileDto
{
    public required Guid ProfileId { get; init; }
    public required string ExpectedProfileVersion { get; init; }
    public string? Name { get; init; }
    public int? Servings { get; init; }
    public RecipeProfileGroceryItemInputDto[]? Groceries { get; init; }
}
