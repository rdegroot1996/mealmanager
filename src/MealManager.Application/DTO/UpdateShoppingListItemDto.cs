namespace MealManager.Application.DTO;

public record UpdateShoppingListItemDto
{
    public string Name { get; init; } = string.Empty;
    public int Quantity { get; init; }
    public required bool Checked { get; init; }
}
