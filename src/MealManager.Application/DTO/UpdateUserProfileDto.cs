namespace MealManager.Application.DTO;

public record UpdateUserProfileDto
{
    public required string DisplayName { get; init; }
}
