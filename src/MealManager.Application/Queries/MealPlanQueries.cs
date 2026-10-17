using MealManager.Application.Mapping;
using MealManager.Domain.Entities;
using MealManager.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace MealManager.Application.Queries;

public class MealPlanQueries(ApplicationDbContext dbContext)
{
    public async Task<MealPlanDto> GetCycleMealPlan(Guid cycleId)
    {
        return (await GetCycleMealPlans([cycleId])).SingleOrDefault()
            ?? throw new NotFoundError(nameof(MealPlan));
    }

    public async Task<ICollection<MealPlanDto>> GetCycleMealPlans(Guid[] cycleIds)
    {
        var mealPlans = await dbContext.MealPlans
            .AsNoTracking()
            .Include(p => p.Entries)
            .Include(p => p.Notes)
            .AsSplitQuery()
            .Where(p => cycleIds.Contains(p.PlanningCycleId)).ToArrayAsync();
        var entries = await MapEntries(mealPlans.SelectMany(mealPlan => mealPlan.Entries).ToArray());
        var entriesById = entries.ToDictionary(entry => entry.Id);
        return mealPlans.Select(mealPlan => new MealPlanDto
        {
            Id = mealPlan.Id,
            PlanningCycleId = mealPlan.PlanningCycleId,
            Entries = mealPlan.Entries.OrderBy(entry => entry.Date).ThenBy(entry => entry.SortOrder).ThenBy(entry => entry.Id)
                .Where(entry => entriesById.ContainsKey(entry.Id)).Select(entry => entriesById[entry.Id]).ToArray(),
            Notes = mealPlan.Notes.OrderBy(note => note.Date).Select(note => note.ToDto()).ToArray(),
        }).ToArray();
    }

    public async Task<UpcomingMealPlanDto> GetUpcomingMealPlan(DateOnly fromDate)
    {
        if (fromDate > DateOnly.MaxValue.AddDays(-6)) throw new ValidationException("Date is outside the supported range.");
        var endDate = fromDate.AddDays(6);
        var future = dbContext.Set<PlannedEntry>().AsNoTracking().Where(entry => entry.Date >= fromDate);
        var entries = await future.OrderBy(entry => entry.Date).ThenBy(entry => entry.SortOrder).ThenBy(entry => entry.Id)
            .Take(3).ToArrayAsync();
        return new UpcomingMealPlanDto
        {
            FromDate = fromDate,
            PlannedDates = await future.Where(entry => entry.Date <= endDate).Select(entry => entry.Date)
                .Distinct().Order().ToArrayAsync(),
            Entries = await MapEntries(entries),
        };
    }

    private async Task<ICollection<PlannedEntryDto>> MapEntries(PlannedEntry[] source)
    {
        var originalIds = source.Select(entry => entry is PlannedLeftover leftover ? leftover.OriginalMealId : entry.Id).Distinct().ToArray();
        var meals = await dbContext.Set<PlannedMeal>().AsNoTracking().Where(meal => originalIds.Contains(meal.Id))
            .ToDictionaryAsync(meal => meal.Id);
        var recipeIds = meals.Values.Select(meal => meal.RecipeId).ToHashSet();
        var recipes = await dbContext.Recipes
            .AsNoTracking()
            .Include(recipe => recipe.Profiles)
            .Include(recipe => recipe.Tags)
            .Include(recipe => recipe.Images)
            .Where(recipe => recipeIds.Contains(recipe.Id))
            .ToDictionaryAsync(recipe => recipe.Id);
        var reviewedMealIds = await dbContext.Set<MealGroceryReview>()
            .Where(marker => meals.Keys.Contains(marker.PlannedMealId))
            .Select(marker => marker.PlannedMealId)
            .ToHashSetAsync();

        var entries = new List<PlannedEntryDto>();
        foreach (var entry in source.OrderBy(entry => entry.Date).ThenBy(entry => entry.SortOrder).ThenBy(entry => entry.Id))
        {
            var original = entry as PlannedMeal
                ?? meals.GetValueOrDefault(((PlannedLeftover)entry).OriginalMealId);
            if (original is null || !recipes.TryGetValue(original.RecipeId, out var recipe)) continue;
            var profile = recipe.Profiles.FirstOrDefault(item => item.Id == original.RecipeProfileId);
            if (profile is null) continue;
            entries.Add(entry.ToDto(recipe, profile, reviewedMealIds.Contains(original.Id)));
        }

        return entries;
    }
}
