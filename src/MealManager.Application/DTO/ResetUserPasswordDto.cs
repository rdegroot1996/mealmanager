namespace MealManager.Application.DTO;

public record ResetUserPasswordDto
{
    public required string TemporaryPassword { get; init; }
}
