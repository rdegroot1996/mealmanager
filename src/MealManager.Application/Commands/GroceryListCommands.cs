using MealManager.Application.Mapping;
using MealManager.Domain.Entities;
using MealManager.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace MealManager.Application.Commands;

public class GroceryListCommands(ApplicationDbContext dbContext)
{
    public async Task<GroceryItemDto> AddManualGroceryItem(Guid cycleId, AddManualGroceryItemDto command)
    {
        var cycleExists = await dbContext.PlanningCycles.AnyAsync(c => c.Id == cycleId);
        if (!cycleExists)
        {
            throw new NotFoundError(nameof(PlanningCycle));
        }
        var groceryList = await dbContext.GroceryLists
            .Include(g => g.Groceries)
            .SingleAsync(g => g.PlanningCycleId == cycleId);

        return await AddItem(groceryList, null, command);
    }

    public async Task<GroceryItemDto> AddMealGroceryItem(Guid planningMealId, AddManualGroceryItemDto command)
    {
        var mealContext = await dbContext.Set<PlanningMeal>()
            .Where(meal => meal.Id == planningMealId)
            .Select(meal => new
            {
                meal.Planning.PlanningCycleId,
                IsReviewed = meal.Groceries != null,
            })
            .SingleOrDefaultAsync()
            ?? throw new NotFoundError(nameof(PlanningMeal));
        if (!mealContext.IsReviewed)
        {
            throw new InvalidOperationError(
                ErrorCodes.GroceriesNotReviewed,
                "Groceries must be reviewed before adding an item to the meal group.");
        }

        var groceryList = await dbContext.GroceryLists
            .Include(list => list.Groceries)
            .SingleOrDefaultAsync(list => list.PlanningCycleId == mealContext.PlanningCycleId)
            ?? throw new NotFoundError(nameof(GroceryList));

        return await AddItem(groceryList, planningMealId, command);
    }

    public async Task<GroceryItemDto> UpdateGroceryItem(Guid itemId, UpdateGroceryItemDto command)
    {
        var groceryList = await dbContext.GroceryLists
            .Include(g => g.Groceries)
            .Where(g => g.Groceries.Any(i => i.Id == itemId))
            .FirstOrDefaultAsync()
         ?? throw new NotFoundError(nameof(GroceryItem));
        var item = groceryList.Groceries.First(i => i.Id == itemId);

        item.Name = command.Name;
        item.Quantity = command.Quantity;
        item.Checked = command.Checked;
        await dbContext.SaveChangesAsync();

        return item.ToDto();
    }

    public async Task RemoveGroceryItem(Guid itemId)
    {
        var groceryList = await dbContext.GroceryLists
            .Include(g => g.Groceries)
            .Where(g => g.Groceries.Any(i => i.Id == itemId))
            .FirstOrDefaultAsync()
         ?? throw new NotFoundError(nameof(GroceryItem));
        var item = groceryList.Groceries.First(i => i.Id == itemId);

        dbContext.Remove(item);
        await dbContext.SaveChangesAsync();
    }

    public async Task<ICollection<GroceryItemDto>> UpdateGroceryItemOrder(
        Guid groceryListId,
        UpdateGroceryItemOrderDto command)
    {
        var groceryList = await dbContext.GroceryLists
            .Include(list => list.Groceries)
            .SingleOrDefaultAsync(list => list.Id == groceryListId)
            ?? throw new NotFoundError(nameof(GroceryList));
        var groupItems = groceryList.Groceries
            .Where(item => item.PlanningMealId == command.PlanningMealId)
            .ToArray();
        if (groupItems.Length != command.ItemIds.Count ||
            groupItems.Select(item => item.Id).ToHashSet().SetEquals(command.ItemIds) is false)
        {
            throw new InvalidOperationError(
                ErrorCodes.InvalidGroceryOrder,
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

    private async Task<GroceryItemDto> AddItem(
        GroceryList groceryList,
        Guid? planningMealId,
        AddManualGroceryItemDto command)
    {
        var item = new GroceryItem
        {
            Id = Guid.CreateVersion7(),
            GroceryListId = groceryList.Id,
            Name = command.Name,
            Quantity = command.Quantity,
            Order = groceryList.Groceries
                .Where(item => item.PlanningMealId == planningMealId)
                .Select(item => item.Order)
                .DefaultIfEmpty(-1)
                .Max() + 1,
            PlanningMealId = planningMealId,
        };
        groceryList.Groceries.Add(item);
        await dbContext.SaveChangesAsync();
        return item.ToDto();
    }
}
