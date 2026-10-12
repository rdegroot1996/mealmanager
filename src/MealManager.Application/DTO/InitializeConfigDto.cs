namespace MealManager.Application.DTO;

public record InitializeConfigDto
{
    public required string AdminEmail { get; init; }
    public required string AdminPassword { get; init; }
    public required string AdminDisplayName { get; init; }
}
