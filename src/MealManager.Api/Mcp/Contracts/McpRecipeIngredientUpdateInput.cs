using System.ComponentModel;

namespace MealManager.Api.Mcp.Contracts;

public sealed record McpRecipeIngredientUpdateInput
{
    [Description("ID of a retained ingredient returned by get_recipe. Omit for a new ingredient.")]
    public Guid? Id { get; init; }
    public required string Name { get; init; }
    [Description("Positive cooking quantity, scaled with servings. Omit for unmeasured amounts.")]
    public decimal? Quantity { get; init; }
    [Description("Unmeasured amount such as 'to taste' or 'a handful', up to 200 characters. Use instead of Quantity; never scales.")]
    public string? QuantityText { get; init; }
    public string Unit { get; init; } = string.Empty;
}
