using MealManager.Domain.Entities;
using MealManager.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace MealManager.Application.Commands;

public class PlanningCycleAccess(ApplicationDbContext dbContext)
{
    public async Task EnsureEditable(Guid cycleId)
    {
        _ = await EnsureEditableCycle(cycleId);
    }

    public async Task EnsureDateInCycle(Guid cycleId, DateOnly date)
    {
        var cycle = await EnsureEditableCycle(cycleId);
        if (date < cycle.StartDate || date > cycle.EndDate)
        {
            throw new InvalidOperationError(
                ErrorCodes.DateOutsideCycle,
                "The date must be inside the planning cycle.");
        }
    }

    public async Task EnsureLeftoverDate(Guid cycleId, DateOnly originalDate, DateOnly targetDate)
    {
        await EnsureDateInCycle(cycleId, targetDate);
        if (targetDate <= originalDate)
        {
            throw new InvalidOperationError(
                ErrorCodes.LeftoverMustFollowOriginal,
                "A leftover must be planned after its original meal.");
        }
    }

    public async Task EnsureCanResize(Guid cycleId, DateOnly startDate, DateOnly endDate)
    {
        _ = await EnsureEditableCycle(cycleId);

        if (await dbContext.PlanningCycles.AnyAsync(cycle => cycle.Id != cycleId && cycle.StartDate > startDate))
        {
            throw new InvalidOperationError(
                ErrorCodes.CycleMustStartAfterExisting,
                "The active planning cycle must start after every other cycle.");
        }

        var hasEntriesOutsideRange = await dbContext.MealPlans
            .Where(p => p.PlanningCycleId == cycleId)
            .SelectMany(p => p.Entries)
            .AnyAsync(entry => entry.Date < startDate || entry.Date > endDate);
        var hasNotesOutsideRange = await dbContext.MealPlans
            .Where(p => p.PlanningCycleId == cycleId)
            .SelectMany(p => p.Notes)
            .AnyAsync(n => n.Date < startDate || n.Date > endDate);
        if (hasEntriesOutsideRange || hasNotesOutsideRange)
        {
            throw new InvalidOperationError(
                ErrorCodes.CycleCannotExcludeEntries,
                "The planning cycle cannot exclude existing meal plan entries.");
        }
    }

    private async Task<PlanningCycle> EnsureEditableCycle(Guid cycleId)
    {
        var cycle = await dbContext.PlanningCycles
            .FirstOrDefaultAsync(c => c.Id == cycleId)
            ?? throw new NotFoundError(nameof(PlanningCycle));

        var latestStartDate = await dbContext.PlanningCycles.MaxAsync(c => c.StartDate);
        if (cycle.StartDate != latestStartDate)
        {
            throw new InvalidOperationError(
                ErrorCodes.HistoricalCycleReadOnly,
                "Historical planning cycles are read-only.");
        }

        return cycle;
    }
}
