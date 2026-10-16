namespace MealManager.Application.DTO;

public record UpdateShoppingListItemOrderDto
{
    public Guid? PlannedMealId { get; init; }
    public required ICollection<Guid> ItemIds { get; init; } = [];
}
