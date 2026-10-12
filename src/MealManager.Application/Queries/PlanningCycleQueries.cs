using MealManager.Domain.Entities;
using MealManager.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace MealManager.Application.Queries;

public class PlanningCycleQueries(ApplicationDbContext dbContext, PlanningQueries planningQueries)
{
    public async Task<RecentPlanningCyclesDto> ListRecentPlanningCycles(int limit = 4, DateOnly? beforeStartDate = null)
    {
        if (limit is < 1 or > 12) throw new ValidationException("Cycle limit must be between 1 and 12.");
        var query = dbContext.PlanningCycles.AsNoTracking();
        // Exclude wholly future cycles by default, but retain a cycle containing today.
        var before = beforeStartDate ?? DateOnly.FromDateTime(DateTime.Today).AddDays(1);
        var cycles = await query.Where(cycle => cycle.StartDate < before).OrderByDescending(cycle => cycle.StartDate)
            .Take(limit + 1).ToArrayAsync();
        var page = cycles.Take(limit).ToArray();
        var plans = (await planningQueries.GetCyclePlannings(page.Select(cycle => cycle.Id).ToArray()))
            .ToDictionary(plan => plan.PlanningCycleId);
        return new RecentPlanningCyclesDto
        {
            Cycles = page.Select(cycle => new RecentPlanningCycleDto
            {
                Id = cycle.Id,
                StartDate = cycle.StartDate,
                EndDate = cycle.EndDate,
                Entries = plans[cycle.Id].Entries,
                Notes = plans[cycle.Id].Notes,
            }).ToArray(),
            NextBeforeStartDate = cycles.Length > limit ? page[^1].StartDate : null,
        };
    }

    public async Task<PlanningCycleDto> GetPlanningCycle(Guid id)
    {
        return await GetPlanningCycles()
                .Where(x => x.Id == id)
                .FirstOrDefaultAsync()
         ?? throw new NotFoundError(nameof(PlanningCycle));
    }

    public async Task<PlanningCycleDto> GetCurrentPlanningCycle() =>
        await GetPlanningCycles()
            .OrderByDescending(x => x.StartDate)
            .FirstOrDefaultAsync()
     ?? throw new NotFoundError(nameof(PlanningCycle));

    private IQueryable<PlanningCycleDto> GetPlanningCycles() =>
        dbContext.PlanningCycles
            .Select(current => new
            {
                Current = current,
                Previous = dbContext.PlanningCycles
                    .Where(x => x.StartDate < current.StartDate)
                    .OrderByDescending(x => x.StartDate)
                    .FirstOrDefault(),
                Next = dbContext.PlanningCycles
                    .Where(x => x.StartDate > current.StartDate)
                    .OrderBy(x => x.StartDate)
                    .FirstOrDefault(),
            })
            .Select(x => new PlanningCycleDto
            {
                Id = x.Current.Id,
                StartDate = x.Current.StartDate,
                EndDate = x.Current.EndDate,
                PreviousPlanningCycleId = x.Previous != null ? x.Previous.Id : null,
                NextPlanningCycleId = x.Next != null ? x.Next.Id : null,
            });
}
