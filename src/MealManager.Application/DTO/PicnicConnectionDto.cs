namespace MealManager.Application.DTO;

public record PicnicConnectionDto
{
    public required string Status { get; init; }
    public required string? AccountLabel { get; init; }
    public required string CountryCode { get; init; }
}
