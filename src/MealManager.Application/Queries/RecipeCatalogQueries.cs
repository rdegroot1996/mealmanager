using MealManager.Application.Mapping;
using MealManager.Domain.Entities;
using MealManager.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace MealManager.Application.Queries;

public sealed class RecipeCatalogQueries(ApplicationDbContext dbContext)
{
    public async Task<RecipeCatalogPageDto> ListRecipes(RecipeCatalogOptions options)
    {
        DiscoveryCursor.ValidatePageSize(options.PageSize);
        if (options.Category.HasValue && !Enum.IsDefined(options.Category.Value))
            throw new ValidationException("Recipe category is invalid.");
        if (options.Tags.Any(string.IsNullOrWhiteSpace)) throw new ValidationException("Tags must contain non-empty label names.");
        var tags = options.Tags.Distinct().Order(StringComparer.Ordinal).ToArray();
        var scope = DiscoveryCursor.Scope(new { kind = "recipes", options.Category, tags, options.Favorite });
        var key = DiscoveryCursor.Decode(options.Cursor, scope);
        var query = dbContext.Recipes.AsNoTracking();
        if (options.Category.HasValue) query = query.Where(recipe => recipe.Category == options.Category);
        if (options.Favorite.HasValue) query = query.Where(recipe => recipe.IsFavorite == options.Favorite);
        foreach (var tag in tags) query = query.Where(recipe => recipe.Tags.Any(value => value.Name == tag));
        var totalCount = await query.CountAsync();
        if (key is not null)
        {
            if (!Guid.TryParseExact(key, "D", out var id)) throw new ValidationException("Recipe cursor is invalid.");
            query = query.Where(recipe => recipe.Id.CompareTo(id) > 0);
        }
        var recipes = await query.OrderBy(recipe => recipe.Id).Take(options.PageSize + 1)
            .Include(recipe => recipe.Tags).Include(recipe => recipe.Ingredients).Include(recipe => recipe.Profiles)
            .AsSplitQuery().ToArrayAsync();
        var page = recipes.Take(options.PageSize).ToArray();
        var pageIds = page.Select(recipe => recipe.Id).ToArray();
        var history = await dbContext.Recipes.Where(recipe => pageIds.Contains(recipe.Id))
            .WithPlanningHistory(dbContext, DateOnly.FromDateTime(DateTime.Today))
            .Select(value => new { value.Recipe.Id, value.PastCount, value.LastPastDate, value.UpcomingCount })
            .ToDictionaryAsync(value => value.Id);
        return new RecipeCatalogPageDto
        {
            TotalCount = totalCount,
            NextCursor = recipes.Length > options.PageSize ? DiscoveryCursor.Encode(page[^1].Id.ToString("D"), scope) : null,
            Recipes = page.Select(recipe => new RecipeCatalogItemDto
            {
                Id = recipe.Id,
                Name = recipe.Name,
                Category = recipe.Category,
                BaseServings = recipe.BaseServings,
                IsFavorite = recipe.IsFavorite,
                PastTimesPlanned = history[recipe.Id].PastCount,
                LastPastPlanned = history[recipe.Id].LastPastDate,
                UpcomingTimesPlanned = history[recipe.Id].UpcomingCount,
                Tags = recipe.Tags.Select(tag => tag.Name).Order(StringComparer.Ordinal).ToArray(),
                Ingredients = recipe.Ingredients.ToDtos(),
                Profiles = recipe.Profiles.OrderBy(profile => profile.Id).ToSummaryDtos(),
            }).ToArray(),
        };
    }

    public async Task<ICollection<RecipeTagSummaryDto>> SearchTags(string? search)
    {
        var query = dbContext.Set<RecipeTag>().AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(tag => tag.Name.Contains(search.Trim()));
        return await query.GroupBy(tag => tag.Name).Select(group => new RecipeTagSummaryDto
        {
            Name = group.Key,
            RecipeCount = group.Select(tag => tag.RecipeId).Distinct().Count(),
        }).OrderByDescending(tag => tag.RecipeCount).ThenBy(tag => tag.Name).Take(50).ToArrayAsync();
    }

    public async Task<RecipeTagPageDto> ListTags(string? cursor, int pageSize)
    {
        DiscoveryCursor.ValidatePageSize(pageSize);
        var scope = DiscoveryCursor.Scope(new { kind = "tags" });
        var key = DiscoveryCursor.Decode(cursor, scope);
        var query = dbContext.Set<RecipeTag>().AsNoTracking().GroupBy(tag => tag.Name)
            .Select(group => new RecipeTagSummaryDto
            {
                Name = group.Key,
                RecipeCount = group.Select(tag => tag.RecipeId).Distinct().Count(),
            });
        var totalCount = await query.CountAsync();
        if (key is not null) query = query.Where(tag => string.Compare(tag.Name, key) > 0);
        var tags = await query.OrderBy(tag => tag.Name).Take(pageSize + 1).ToArrayAsync();
        var page = tags.Take(pageSize).ToArray();
        return new RecipeTagPageDto
        {
            Tags = page,
            TotalCount = totalCount,
            NextCursor = tags.Length > pageSize ? DiscoveryCursor.Encode(page[^1].Name, scope) : null,
        };
    }
}
