namespace MealManager.Application.DTO;

public record ConnectPicnicDto
{
    public required string Email { get; init; }
    public required string Password { get; init; }
    public string CountryCode { get; init; } = "NL";
    public bool ResetProductMappings { get; init; }
}
