using System.ComponentModel;

namespace MealManager.Api.Mcp.Contracts;

public sealed record McpRecipeIngredientUpdateInput
{
    [Description("ID of a retained ingredient returned by get_recipe. Omit for a new ingredient.")]
    public Guid? Id { get; init; }
    public required string Name { get; init; }
    public required decimal Quantity { get; init; }
    public required string Unit { get; init; }
}
