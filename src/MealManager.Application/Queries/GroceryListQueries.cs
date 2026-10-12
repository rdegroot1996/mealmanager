using MealManager.Application.Mapping;
using MealManager.Domain.Entities;
using MealManager.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace MealManager.Application.Queries;

public class GroceryListQueries(ApplicationDbContext dbContext)
{
    public async Task<string[]> SuggestNames(string? search, int limit = 10)
    {
        if (limit is < 1 or > 20) throw new ValidationException("Suggestion limit must be between 1 and 20.");
        var query = search?.Trim().ToLowerInvariant() ?? "";
        if (query.Length > 100) throw new ValidationException("Suggestion search must not exceed 100 characters.");
        if (query.Length == 0) return [];
        return await dbContext.Set<GroceryItem>().AsNoTracking()
            .Where(item => item.Name.Trim().ToLower().Contains(query))
            .GroupBy(item => item.Name.Trim().ToLower())
            .Select(group => group.Min(item => item.Name.Trim())!)
            .OrderByDescending(name => name.ToLower().StartsWith(query)).ThenBy(name => name.ToLower())
            .Take(limit).ToArrayAsync();
    }

    public async Task<PlanningMealGroceriesDto> GetPlanningMealGroceries(Guid mealId)
    {
        var planning = await dbContext.Plannings
            .Where(planning => planning.Entries.Any(entry => entry.Id == mealId))
            .Select(planning => new
            {
                planning.PlanningCycleId,
                Meal = planning.Entries.OfType<PlanningMeal>().SingleOrDefault(meal => meal.Id == mealId),
            })
            .FirstOrDefaultAsync();

        if (planning?.Meal is null)
        {
            throw new NotFoundError(nameof(PlanningMeal));
        }

        var meal = planning.Meal;

        var recipe = await dbContext.Recipes
            .Include(r => r.Profiles)
            .Include(r => r.Images)
            .FirstOrDefaultAsync(r => r.Id == meal.RecipeId)
            ?? throw new NotFoundError(nameof(Recipe));
        var profile = recipe.Profiles.FirstOrDefault(p => p.Id == meal.RecipeProfileId)
            ?? throw new NotFoundError(nameof(RecipeProfile));

        var groceryItems = await dbContext.GroceryLists
            .Where(g => g.PlanningCycleId == planning.PlanningCycleId)
            .SelectMany(g => g.Groceries)
            .Where(g => g.PlanningMealId == mealId)
            .ToArrayAsync();

        return new PlanningMealGroceriesDto
        {
            PlanningMeal = meal.ToSummaryDto(recipe, profile),
            Groceries = groceryItems.ToDtos(),
        };
    }

    public async Task<GroceryListDto> GetCycleGroceryList(Guid cycleId)
    {
        var groceryList = await dbContext.GroceryLists
                .Include(g => g.Groceries)
                .FirstOrDefaultAsync(g => g.PlanningCycleId == cycleId)
         ?? throw new NotFoundError(nameof(GroceryList));

        // A MealGroceries record records that the household has reviewed a meal's
        // groceries, including when the resulting selection is empty.
        var mealGroceries = groceryList.Groceries
            .Where(g => g.PlanningMealId.HasValue)
            .GroupBy(g => g.PlanningMealId!.Value)
            .ToDictionary(group => group.Key, group => group.ToArray());

        var meals = await dbContext.Plannings
            .Where(planning => planning.PlanningCycleId == cycleId)
            .SelectMany(planning => planning.Entries.OfType<PlanningMeal>())
            .Where(meal => meal.Groceries != null)
            .ToDictionaryAsync(meal => meal.Id);
        var planningMealGroceries = new List<PlanningMealGroceriesDto>();
        var recipeIds = meals.Values.Select(meal => meal.RecipeId).Distinct().ToArray();
        var recipes = await dbContext.Recipes
            .Include(recipe => recipe.Profiles)
            .Include(recipe => recipe.Images)
            .Where(recipe => recipeIds.Contains(recipe.Id))
            .ToDictionaryAsync(recipe => recipe.Id);

        foreach (var meal in meals.Values.OrderBy(meal => meal.Date).ThenBy(meal => meal.Id))
        {
            if (!recipes.TryGetValue(meal.RecipeId, out var recipe)) continue;

            var profile = recipe.Profiles.FirstOrDefault(p => p.Id == meal.RecipeProfileId);
            if (profile is null) continue;

            planningMealGroceries.Add(new PlanningMealGroceriesDto
            {
                PlanningMeal = meal.ToSummaryDto(recipe, profile),
                Groceries = mealGroceries.GetValueOrDefault(meal.Id, []).ToDtos(),
            });
        }

        // Manual groceries (no meal association)
        var manualGroceries = groceryList.Groceries
            .Where(g => g.PlanningMealId is null)
            .ToDtos();

        return new GroceryListDto
        {
            Id = groceryList.Id,
            PlanningCycleId = groceryList.PlanningCycleId,
            PlanningMealGroceries = planningMealGroceries,
            Groceries = manualGroceries,
        };
    }
}
