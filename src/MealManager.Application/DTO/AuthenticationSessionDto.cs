namespace MealManager.Application.DTO;

public record AuthenticationSessionDto
{
    public required bool IsAuthenticated { get; init; }

    public required string AntiforgeryToken { get; init; }
}
