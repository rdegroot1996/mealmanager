namespace MealManager.Application.DTO;

public record CreateUserDto
{
    public required string Email { get; init; }
    public required string Password { get; init; }
    public required string DisplayName { get; init; }
    public required bool IsAdmin { get; init; }
}
