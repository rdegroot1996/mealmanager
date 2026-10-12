namespace MealManager.Application.DTO;

public record AppConfigDto
{
    public required bool AppInitialized { get; init; }
}
