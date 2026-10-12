using MealManager.Domain.Entities;
using MealManager.Infrastructure.Database;

namespace MealManager.Application.Queries;

internal static class RecipePlanningHistory
{
    public static IQueryable<RecipeWithPlanningHistory> WithPlanningHistory(
        this IQueryable<Recipe> recipes, ApplicationDbContext dbContext, DateOnly today) =>
        recipes.Select(recipe => new RecipeWithPlanningHistory
        {
            Recipe = recipe,
            PastCount = dbContext.Set<PlanningMeal>().Count(meal => meal.RecipeId == recipe.Id && meal.Date <= today),
            LastPastDate = dbContext.Set<PlanningMeal>().Where(meal => meal.RecipeId == recipe.Id && meal.Date <= today)
                .Select(meal => (DateOnly?)meal.Date).Max(),
            UpcomingCount = dbContext.Set<PlanningMeal>().Count(meal => meal.RecipeId == recipe.Id && meal.Date > today),
            RecentCount = dbContext.Set<PlanningMeal>().Count(meal => meal.RecipeId == recipe.Id
                && meal.Date >= today.AddDays(-89) && meal.Date <= today),
        });
}
