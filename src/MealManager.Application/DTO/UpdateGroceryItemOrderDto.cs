namespace MealManager.Application.DTO;

public record UpdateGroceryItemOrderDto
{
    public Guid? PlanningMealId { get; init; }
    public required ICollection<Guid> ItemIds { get; init; } = [];
}
