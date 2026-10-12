namespace MealManager.Api.Mcp;

internal static class MealManagerMcpInstructions
{
    public static string Text { get; } = Load();

    private static string Load()
    {
        using var reader = new StreamReader(typeof(MealManagerMcpInstructions).Assembly
            .GetManifestResourceStream("MealManager.Api.Mcp.Instructions.md")!);
        return reader.ReadToEnd();
    }
}
