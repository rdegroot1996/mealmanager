namespace MealManager.Api.Mcp.Contracts;

public sealed record McpProfileProductInput
{
    public Guid? Id { get; init; }
    public required string Name { get; init; }
    public required int Quantity { get; init; }
    public bool AtHome { get; init; }
}
