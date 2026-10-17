using MealManager.Application.Mapping;
using MealManager.Domain.Entities;
using MealManager.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace MealManager.Application.Queries;

public class ShoppingListQueries(ApplicationDbContext dbContext)
{
    public async Task<string[]> SuggestNames(string? search, int limit = 10)
    {
        if (limit is < 1 or > 20) throw new ValidationException("Suggestion limit must be between 1 and 20.");
        var query = search?.Trim().ToLowerInvariant() ?? "";
        if (query.Length > 100) throw new ValidationException("Suggestion search must not exceed 100 characters.");
        if (query.Length == 0) return [];
        return await dbContext.Set<ShoppingListItem>().AsNoTracking()
            .Where(item => item.Name.Trim().ToLower().Contains(query))
            .GroupBy(item => item.Name.Trim().ToLower())
            .Select(group => group.Min(item => item.Name.Trim())!)
            .OrderByDescending(name => name.ToLower().StartsWith(query)).ThenBy(name => name.ToLower())
            .Take(limit).ToArrayAsync();
    }

    public async Task<MealShoppingGroupDto> GetMealShoppingGroup(Guid mealId)
    {
        var mealPlan = await dbContext.MealPlans
            .Where(mealPlan => mealPlan.Entries.Any(entry => entry.Id == mealId))
            .Select(mealPlan => new
            {
                mealPlan.PlanningCycleId,
                Meal = mealPlan.Entries.OfType<PlannedMeal>().SingleOrDefault(meal => meal.Id == mealId),
            })
            .FirstOrDefaultAsync();

        if (mealPlan?.Meal is null)
        {
            throw new NotFoundError(nameof(PlannedMeal));
        }

        var meal = mealPlan.Meal;

        var recipe = await dbContext.Recipes
            .Include(r => r.Profiles)
            .Include(r => r.Images)
            .FirstOrDefaultAsync(r => r.Id == meal.RecipeId)
            ?? throw new NotFoundError(nameof(Recipe));
        var profile = recipe.Profiles.FirstOrDefault(p => p.Id == meal.RecipeProfileId)
            ?? throw new NotFoundError(nameof(RecipeProfile));

        var shoppingListItems = await dbContext.ShoppingLists
            .Where(g => g.PlanningCycleId == mealPlan.PlanningCycleId)
            .SelectMany(g => g.Items)
            .Where(g => g.PlannedMealId == mealId)
            .ToArrayAsync();

        return new MealShoppingGroupDto
        {
            Meal = meal.ToSummaryDto(recipe, profile),
            Items = shoppingListItems.ToDtos(),
        };
    }

    public async Task<ShoppingListDto> GetCycleShoppingList(Guid cycleId)
    {
        var shoppingList = await dbContext.ShoppingLists
                .Include(g => g.Items)
                .FirstOrDefaultAsync(g => g.PlanningCycleId == cycleId)
         ?? throw new NotFoundError(nameof(ShoppingList));

        // A MealGroceryReview record records that the household has reviewed a meal's
        // groceries, including when the resulting selection is empty.
        var mealGroceries = shoppingList.Items
            .Where(g => g.PlannedMealId.HasValue)
            .GroupBy(g => g.PlannedMealId!.Value)
            .ToDictionary(group => group.Key, group => group.ToArray());

        var meals = await dbContext.MealPlans
            .Where(mealPlan => mealPlan.PlanningCycleId == cycleId)
            .SelectMany(mealPlan => mealPlan.Entries.OfType<PlannedMeal>())
            .Where(meal => meal.GroceryReview != null)
            .ToDictionaryAsync(meal => meal.Id);
        var mealGroups = new List<MealShoppingGroupDto>();
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

            mealGroups.Add(new MealShoppingGroupDto
            {
                Meal = meal.ToSummaryDto(recipe, profile),
                Items = mealGroceries.GetValueOrDefault(meal.Id, []).ToDtos(),
            });
        }

        // Manual groceries (no meal association)
        var manualGroceries = shoppingList.Items
            .Where(g => g.PlannedMealId is null)
            .ToDtos();

        return new ShoppingListDto
        {
            Id = shoppingList.Id,
            PlanningCycleId = shoppingList.PlanningCycleId,
            MealGroups = mealGroups,
            Items = manualGroceries,
        };
    }
}
