using System.ComponentModel;

namespace MealManager.Api.Mcp.Contracts;

public sealed record McpRecipeStepUpdateInput
{
    [Description("ID of a retained step returned by get_recipe. Omit for a new step.")]
    public Guid? Id { get; init; }
    public required string Description { get; init; }
}
