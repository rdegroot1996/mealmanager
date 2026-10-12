namespace MealManager.Api.Mcp;

public sealed class MealManagerMcpOptions
{
    public const string SectionName = "Mcp";
    public const string AuthenticationScheme = "MealManagerMcpToken";
    public const string AuthorizationPolicy = "MealManagerMcp";

    public bool Enabled { get; init; }
    public string? AccessToken { get; init; }
}
