using MealManager.Domain.Entities;

namespace MealManager.Application.Mapping;

public static class GroceryListMappingExtensions
{
    public static GroceryItemDto ToDto(this GroceryItem groceryItem) =>
        new()
        {
            Id = groceryItem.Id,
            Name = groceryItem.Name,
            Quantity = groceryItem.Quantity,
            Order = groceryItem.Order,
            Checked = groceryItem.Checked,
            RecipeProfileProductId = groceryItem.RecipeProfileProductId,
            PlanningMealId = groceryItem.PlanningMealId,
        };

    public static ICollection<GroceryItemDto> ToDtos(this IEnumerable<GroceryItem> items) =>
        items.OrderBy(i => i.Order).ThenBy(i => i.Id).Select(i => i.ToDto()).ToArray();
}
