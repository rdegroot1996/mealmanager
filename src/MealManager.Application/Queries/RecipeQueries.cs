using MealManager.Application.Mapping;
using MealManager.Domain.Entities;
using MealManager.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace MealManager.Application.Queries;

public class RecipeQueries(ApplicationDbContext dbContext)
{
    public async Task<RecipeDetailsDto> GetRecipe(Guid id)
    {
        var recipe = await dbContext.Recipes
                .AsNoTracking()
                .Where(r => r.Id == id)
                .Include(r => r.Tags)
                .Include(r => r.Images)
                .Include(r => r.Ingredients)
                .Include(r => r.Steps)
                .Include(r => r.Profiles)
                .AsSplitQuery()
                .FirstOrDefaultAsync()
         ?? throw new NotFoundError(nameof(Recipe));

        var plannedDates = dbContext.Set<PlannedMeal>()
            .Where(meal => meal.RecipeId == id)
            .Select(meal => meal.Date);
        var today = DateOnly.FromDateTime(DateTime.Today);
        var pastDates = plannedDates.Where(date => date <= today);
        var timesPlanned = await pastDates.CountAsync();
        var lastPlanned = await pastDates
            .OrderByDescending(date => date)
            .Select(date => (DateOnly?)date)
            .FirstOrDefaultAsync();

        var upcoming = plannedDates.Where(date => date > today);
        var upcomingCount = await upcoming.CountAsync();
        return recipe.ToDetailsDto(timesPlanned, lastPlanned, upcomingCount);
    }

}
