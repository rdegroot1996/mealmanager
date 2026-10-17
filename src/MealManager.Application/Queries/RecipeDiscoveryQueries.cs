using MealManager.Application.Mapping;
using MealManager.Domain.Entities;
using MealManager.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace MealManager.Application.Queries;

public sealed class RecipeDiscoveryQueries(ApplicationDbContext dbContext)
{
    public async Task<ICollection<RecipeSearchResultDto>> SearchRecipes(RecipeSearchOptions options)
    {
        if (!Enum.IsDefined(options.Sort)) throw new ValidationException("Recipe sort is invalid.");
        if (options.Category.HasValue && !Enum.IsDefined(options.Category.Value)) throw new ValidationException("Recipe category is invalid.");
        var query = dbContext.Recipes.AsNoTracking()
            .Include(recipe => recipe.Tags).Include(recipe => recipe.Images)
            .Include(recipe => recipe.Ingredients).Include(recipe => recipe.Profiles).AsSplitQuery();
        if (options.Category.HasValue) query = query.Where(recipe => recipe.Category == options.Category);
        foreach (var tag in options.Tags)
        {
            if (string.IsNullOrWhiteSpace(tag)) throw new ValidationException("Tags must contain non-empty tag names.");
            query = query.Where(recipe => recipe.Tags.Any(value => value.Name == tag));
        }
        if (!string.IsNullOrWhiteSpace(options.Search))
        {
            var search = options.Search.Trim();
            query = query.Where(recipe => recipe.Name.Contains(search));
        }
        if (options.Favorite.HasValue) query = query.Where(recipe => recipe.IsFavorite == options.Favorite);
        var today = DateOnly.FromDateTime(DateTime.Today);
        var candidates = query.WithPlanningHistory(dbContext, today);
        var sorted = options.Sort switch
        {
            RecipeSearchSort.LeastPlanned => candidates.OrderBy(value => value.PastCount + value.UpcomingCount)
                .ThenBy(value => value.LastPastDate).ThenBy(value => value.Recipe.Name).ThenBy(value => value.Recipe.Id),
            RecipeSearchSort.LeastRecentlyPlanned => candidates.OrderBy(value => value.LastPastDate)
                .ThenBy(value => value.Recipe.Name).ThenBy(value => value.Recipe.Id),
            RecipeSearchSort.MostPlanned => candidates.OrderByDescending(value => value.PastCount + value.UpcomingCount)
                .ThenBy(value => value.Recipe.Name).ThenBy(value => value.Recipe.Id),
            RecipeSearchSort.MostRecentlyPlanned => candidates.OrderByDescending(value => value.LastPastDate)
                .ThenBy(value => value.Recipe.Name).ThenBy(value => value.Recipe.Id),
            RecipeSearchSort.RecentPlanningPopularity => candidates.OrderByDescending(value => value.RecentCount)
                .ThenBy(value => value.Recipe.Name).ThenBy(value => value.Recipe.Id),
            _ => candidates.OrderBy(value => value.Recipe.Name).ThenBy(value => value.Recipe.Id),
        };
        var rows = await (options.Limit.HasValue
            ? sorted.Take(Math.Clamp(options.Limit.Value, 1, 500))
            : sorted).ToArrayAsync();
        return rows.Select(value => new RecipeSearchResultDto
        {
            Id = value.Recipe.Id,
            Name = value.Recipe.Name,
            Category = value.Recipe.Category,
            BaseServings = value.Recipe.BaseServings,
            IsFavorite = value.Recipe.IsFavorite,
            Tags = value.Recipe.Tags.ToDtos(),
            ImageUrl = value.Recipe.Images.OrderBy(image => image.Order).FirstOrDefault().ToImageUrl(),
            Ingredients = value.Recipe.Ingredients.ToDtos(),
            Profiles = value.Recipe.Profiles.ToSummaryDtos(),
            PastTimesPlanned = value.PastCount,
            LastPastPlanned = value.LastPastDate,
            UpcomingTimesPlanned = value.UpcomingCount,
        }).ToArray();
    }
}
