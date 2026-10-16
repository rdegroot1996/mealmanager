using MealManager.Application.Mapping;
using MealManager.Domain.Entities;
using MealManager.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace MealManager.Application.Commands;

public class ShoppingListCommands(ApplicationDbContext dbContext)
{
    public async Task<ShoppingListItemDto> AddManualShoppingListItem(Guid cycleId, AddManualShoppingListItemDto command)
    {
        var cycleExists = await dbContext.PlanningCycles.AnyAsync(c => c.Id == cycleId);
        if (!cycleExists)
        {
            throw new NotFoundError(nameof(PlanningCycle));
        }
        var shoppingList = await dbContext.ShoppingLists
            .Include(g => g.Items)
            .SingleAsync(g => g.PlanningCycleId == cycleId);

        return await AddItem(shoppingList, null, command);
    }

    public async Task<ShoppingListItemDto> AddMealShoppingListItem(Guid plannedMealId, AddManualShoppingListItemDto command)
    {
        var mealContext = await dbContext.Set<PlannedMeal>()
            .Where(meal => meal.Id == plannedMealId)
            .Select(meal => new
            {
                meal.MealPlan.PlanningCycleId,
                IsReviewed = meal.GroceryReview != null,
            })
            .SingleOrDefaultAsync()
            ?? throw new NotFoundError(nameof(PlannedMeal));
        if (!mealContext.IsReviewed)
        {
            throw new InvalidOperationError(
                ErrorCodes.GroceriesNotReviewed,
                "Items must be reviewed before adding an item to the meal group.");
        }

        var shoppingList = await dbContext.ShoppingLists
            .Include(list => list.Items)
            .SingleOrDefaultAsync(list => list.PlanningCycleId == mealContext.PlanningCycleId)
            ?? throw new NotFoundError(nameof(ShoppingList));

        return await AddItem(shoppingList, plannedMealId, command);
    }

    public async Task<ShoppingListItemDto> UpdateShoppingListItem(Guid itemId, UpdateShoppingListItemDto command)
    {
        var shoppingList = await dbContext.ShoppingLists
            .Include(g => g.Items)
            .Where(g => g.Items.Any(i => i.Id == itemId))
            .FirstOrDefaultAsync()
         ?? throw new NotFoundError(nameof(ShoppingListItem));
        var item = shoppingList.Items.First(i => i.Id == itemId);

        item.Name = command.Name;
        item.Quantity = command.Quantity;
        item.Checked = command.Checked;
        await dbContext.SaveChangesAsync();

        return item.ToDto();
    }

    public async Task RemoveShoppingListItem(Guid itemId)
    {
        var shoppingList = await dbContext.ShoppingLists
            .Include(g => g.Items)
            .Where(g => g.Items.Any(i => i.Id == itemId))
            .FirstOrDefaultAsync()
         ?? throw new NotFoundError(nameof(ShoppingListItem));
        var item = shoppingList.Items.First(i => i.Id == itemId);

        dbContext.Remove(item);
        await dbContext.SaveChangesAsync();
    }

    public async Task<ICollection<ShoppingListItemDto>> UpdateShoppingListItemOrder(
        Guid shoppingListId,
        UpdateShoppingListItemOrderDto command)
    {
        var shoppingList = await dbContext.ShoppingLists
            .Include(list => list.Items)
            .SingleOrDefaultAsync(list => list.Id == shoppingListId)
            ?? throw new NotFoundError(nameof(ShoppingList));
        var groupItems = shoppingList.Items
            .Where(item => item.PlannedMealId == command.PlannedMealId)
            .ToArray();
        if (groupItems.Length != command.ItemIds.Count ||
            groupItems.Select(item => item.Id).ToHashSet().SetEquals(command.ItemIds) is false)
        {
            throw new InvalidOperationError(
                ErrorCodes.InvalidShoppingListOrder,
                "The order must contain every item in the grocery group exactly once.");
        }

        var byId = groupItems.ToDictionary(item => item.Id);
        foreach (var (itemId, order) in command.ItemIds.Select((id, order) => (id, order)))
        {
            byId[itemId].Order = order;
        }
        await dbContext.SaveChangesAsync();
        return groupItems.ToDtos();
    }

    private async Task<ShoppingListItemDto> AddItem(
        ShoppingList shoppingList,
        Guid? plannedMealId,
        AddManualShoppingListItemDto command)
    {
        var item = new ShoppingListItem
        {
            Id = Guid.CreateVersion7(),
            ShoppingListId = shoppingList.Id,
            Name = command.Name,
            Quantity = command.Quantity,
            Order = shoppingList.Items
                .Where(item => item.PlannedMealId == plannedMealId)
                .Select(item => item.Order)
                .DefaultIfEmpty(-1)
                .Max() + 1,
            PlannedMealId = plannedMealId,
        };
        shoppingList.Items.Add(item);
        await dbContext.SaveChangesAsync();
        return item.ToDto();
    }
}
