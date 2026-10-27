using MealManager.Domain.Entities;
using MealManager.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace MealManager.Application.Commands;

public class PlanningCycleCommands(ApplicationDbContext dbContext, PlanningCycleQueries queries, PlanningCycleAccess cycleAccess)
{
    public async Task<PlanningCycleDto> CreatePlanningCycle(CreatePlanningCycleDto command)
    {
        var (cycle, _) = await AddCycle(command);
        await dbContext.SaveChangesAsync();
        return await queries.GetPlanningCycle(cycle.Id);
    }

    internal async Task<(PlanningCycle Cycle, MealPlan MealPlan)> AddCycle(CreatePlanningCycleDto command)
    {
        var latestStartDate = await dbContext.PlanningCycles
            .Select(cycle => (DateOnly?)cycle.StartDate)
            .MaxAsync();
        if (latestStartDate.HasValue && command.StartDate <= latestStartDate.Value)
        {
            throw new InvalidOperationError(
                ErrorCodes.CycleMustStartAfterExisting,
                "A new planning cycle must start after every existing cycle.");
        }

        // Create cycle
        var planningCycle = new PlanningCycle
        {
            Id = Guid.CreateVersion7(),
            StartDate = command.StartDate,
            EndDate = command.EndDate,
        };
        dbContext.PlanningCycles.Add(planningCycle);

        // Create meal plan
        var mealPlan = new MealPlan
        {
            Id = Guid.CreateVersion7(),
            PlanningCycleId = planningCycle.Id,
        };
        dbContext.MealPlans.Add(mealPlan);

        // Create shopping list
        var shoppingList = new ShoppingList
        {
            Id = Guid.CreateVersion7(),
            PlanningCycleId = planningCycle.Id,
        };
        dbContext.ShoppingLists.Add(shoppingList);

        return (planningCycle, mealPlan);
    }

    public async Task<PlanningCycleDto> UpdatePlanningCycle(Guid id, UpdatePlanningCycleDto command)
    {
        await cycleAccess.EnsureCanResize(id, command.StartDate, command.EndDate);
        if (await dbContext.PlanningCycles.AnyAsync(cycle => cycle.Id != id && cycle.StartDate == command.StartDate))
        {
            throw new InvalidOperationError(
                ErrorCodes.CycleStartDateExists,
                "A planning cycle with this start date already exists.");
        }
        var planningCycle = dbContext.PlanningCycles.SingleOrDefault(pc => pc.Id == id)
         ?? throw new NotFoundError(nameof(PlanningCycle));

        planningCycle.StartDate = command.StartDate;
        planningCycle.EndDate = command.EndDate;

        await dbContext.SaveChangesAsync();

        return await queries.GetPlanningCycle(planningCycle.Id);
    }

    public async Task DeletePlanningCycle(Guid id)
    {
        await cycleAccess.EnsureActive(id);
        var planningCycle = await dbContext.PlanningCycles.FindAsync(id)
            ?? throw new NotFoundError(nameof(PlanningCycle));

        dbContext.PlanningCycles.Remove(planningCycle);
        await dbContext.SaveChangesAsync();
    }
}
