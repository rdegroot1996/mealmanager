namespace MealManager.Application.DTO;

public record UpdateRecipeImageOrderDto
{
    public required ICollection<Guid> ImageIds { get; init; }
}
