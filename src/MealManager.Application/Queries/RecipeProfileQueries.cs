using MealManager.Application.Mapping;
using MealManager.Domain.Entities;
using MealManager.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace MealManager.Application.Queries;

public class RecipeProfileQueries(ApplicationDbContext dbContext)
{
    public async Task<RecipeProfileDto> GetRecipeProfile(Guid id)
    {
        var recipe = await dbContext.Recipes
                .AsNoTracking()
                .Include(r => r.Profiles)
                    .ThenInclude(p => p.Groceries)
                .FirstOrDefaultAsync(r => r.Profiles.Any(p => p.Id == id))
            ?? throw new NotFoundError(nameof(RecipeProfile));

        var profile = recipe.Profiles.First(p => p.Id == id);
        return profile.ToDto();
    }
}
