namespace MealManager.Application.DTO;

public record SetRecipeFavoriteDto
{
    public required bool IsFavorite { get; init; }
}
