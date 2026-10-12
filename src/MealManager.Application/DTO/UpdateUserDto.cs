namespace MealManager.Application.DTO;

public record UpdateUserDto
{
    public required string DisplayName { get; init; }
    public required bool IsAdmin { get; init; }
}
