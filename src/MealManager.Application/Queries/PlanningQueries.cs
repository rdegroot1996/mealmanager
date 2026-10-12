using MealManager.Application.Mapping;
using MealManager.Domain.Entities;
using MealManager.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace MealManager.Application.Queries;

public class PlanningQueries(ApplicationDbContext dbContext)
{
    public async Task<PlanningDto> GetCyclePlanning(Guid cycleId)
    {
        return (await GetCyclePlannings([cycleId])).SingleOrDefault()
            ?? throw new NotFoundError(nameof(Planning));
    }

    public async Task<ICollection<PlanningDto>> GetCyclePlannings(Guid[] cycleIds)
    {
        var plannings = await dbContext.Plannings
            .AsNoTracking()
            .Include(p => p.Entries)
            .Include(p => p.Notes)
            .AsSplitQuery()
            .Where(p => cycleIds.Contains(p.PlanningCycleId)).ToArrayAsync();
        var entries = await MapEntries(plannings.SelectMany(planning => planning.Entries).ToArray());
        var entriesById = entries.ToDictionary(entry => entry.Id);
        return plannings.Select(planning => new PlanningDto
        {
            Id = planning.Id,
            PlanningCycleId = planning.PlanningCycleId,
            Entries = planning.Entries.OrderBy(entry => entry.Date).ThenBy(entry => entry.SortOrder).ThenBy(entry => entry.Id)
                .Where(entry => entriesById.ContainsKey(entry.Id)).Select(entry => entriesById[entry.Id]).ToArray(),
            Notes = planning.Notes.OrderBy(note => note.Date).Select(note => note.ToDto()).ToArray(),
        }).ToArray();
    }

    public async Task<UpcomingPlanningDto> GetUpcomingPlanning(DateOnly fromDate)
    {
        if (fromDate > DateOnly.MaxValue.AddDays(-6)) throw new ValidationException("Date is outside the supported range.");
        var endDate = fromDate.AddDays(6);
        var future = dbContext.Set<PlanningEntry>().AsNoTracking().Where(entry => entry.Date >= fromDate);
        var entries = await future.OrderBy(entry => entry.Date).ThenBy(entry => entry.SortOrder).ThenBy(entry => entry.Id)
            .Take(3).ToArrayAsync();
        return new UpcomingPlanningDto
        {
            FromDate = fromDate,
            PlannedDates = await future.Where(entry => entry.Date <= endDate).Select(entry => entry.Date)
                .Distinct().Order().ToArrayAsync(),
            Entries = await MapEntries(entries),
        };
    }

    private async Task<ICollection<PlanningEntryDto>> MapEntries(PlanningEntry[] source)
    {
        var originalIds = source.Select(entry => entry is PlanningLeftover leftover ? leftover.OriginalMealId : entry.Id).Distinct().ToArray();
        var meals = await dbContext.Set<PlanningMeal>().AsNoTracking().Where(meal => originalIds.Contains(meal.Id))
            .ToDictionaryAsync(meal => meal.Id);
        var recipeIds = meals.Values.Select(meal => meal.RecipeId).ToHashSet();
        var recipes = await dbContext.Recipes
            .AsNoTracking()
            .Include(recipe => recipe.Profiles)
            .Include(recipe => recipe.Tags)
            .Include(recipe => recipe.Images)
            .Where(recipe => recipeIds.Contains(recipe.Id))
            .ToDictionaryAsync(recipe => recipe.Id);
        var reviewedMealIds = await dbContext.Set<MealGroceries>()
            .Where(marker => meals.Keys.Contains(marker.PlanningMealId))
            .Select(marker => marker.PlanningMealId)
            .ToHashSetAsync();

        var entries = new List<PlanningEntryDto>();
        foreach (var entry in source.OrderBy(entry => entry.Date).ThenBy(entry => entry.SortOrder).ThenBy(entry => entry.Id))
        {
            var original = entry as PlanningMeal
                ?? meals.GetValueOrDefault(((PlanningLeftover)entry).OriginalMealId);
            if (original is null || !recipes.TryGetValue(original.RecipeId, out var recipe)) continue;
            var profile = recipe.Profiles.FirstOrDefault(item => item.Id == original.RecipeProfileId);
            if (profile is null) continue;
            entries.Add(entry.ToDto(recipe, profile, reviewedMealIds.Contains(original.Id)));
        }

        return entries;
    }
}
