namespace MealManager.Application.DTO;

public record UserDto
{
    public required Guid Id { get; init; }
    public required string Email { get; init; }
    public required string DisplayName { get; init; }
    public required bool IsAdmin { get; init; }
    public bool MustChangePassword { get; init; }
}
