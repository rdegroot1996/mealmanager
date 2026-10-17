using MealManager.Domain.Entities;

namespace MealManager.Application.Mapping;

public static class ShoppingListMappingExtensions
{
    public static ShoppingListItemDto ToDto(this ShoppingListItem shoppingListItem) =>
        new()
        {
            Id = shoppingListItem.Id,
            Name = shoppingListItem.Name,
            Quantity = shoppingListItem.Quantity,
            Order = shoppingListItem.Order,
            Checked = shoppingListItem.Checked,
            RecipeProfileGroceryItemId = shoppingListItem.RecipeProfileGroceryItemId,
            PlannedMealId = shoppingListItem.PlannedMealId,
        };

    public static ICollection<ShoppingListItemDto> ToDtos(this IEnumerable<ShoppingListItem> items) =>
        items.OrderBy(i => i.Order).ThenBy(i => i.Id).Select(i => i.ToDto()).ToArray();
}
