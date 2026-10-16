using System.ComponentModel;

namespace MealManager.Application.DTO;

public record ShoppingListDto
{
    public required Guid Id { get; init; }
    public required Guid PlanningCycleId { get; init; }
    [Description("Reviewed meal groups. Each contains its original meal ID, date, recipe name, serving profile and shopping items; a reviewed group can be empty.")]
    public required ICollection<MealShoppingGroupDto> MealGroups { get; init; }
    [Description("Other items, without a meal association. Their plannedMealId is null.")]
    public required ICollection<ShoppingListItemDto> Items { get; init; }
}
