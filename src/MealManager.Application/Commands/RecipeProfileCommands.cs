using MealManager.Application.Mapping;
using MealManager.Domain.Entities;
using MealManager.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace MealManager.Application.Commands;

public class RecipeProfileCommands(ApplicationDbContext dbContext)
{
    public async Task<RecipeProfileDto> AddRecipeProfile(AddRecipeProfileDto command)
    {
        var recipe = await dbContext.Recipes
            .FirstOrDefaultAsync(r => r.Id == command.RecipeId)
            ?? throw new NotFoundError(nameof(Recipe));

        var profileId = Guid.CreateVersion7();
        var profile = new RecipeProfile
        {
            Id = profileId,
            RecipeId = recipe.Id,
            Name = command.Name,
            Servings = command.Servings,
            Groceries = command.Groceries.Select((item, order) => new RecipeProfileGroceryItem
            {
                Id = Guid.CreateVersion7(),
                RecipeProfileId = profileId,
                Name = item.Name,
                Quantity = item.Quantity,
                AtHome = item.AtHome,
                Order = order,
            }).ToList(),
        };

        recipe.Profiles.Add(profile);
        await dbContext.SaveChangesAsync();

        return profile.ToDto();
    }

    public async Task<RecipeProfileDto> UpdateRecipeProfile(Guid id, UpdateRecipeProfileDto command)
    {
        var recipe = await dbContext.Recipes
                .Include(r => r.Profiles)
                .ThenInclude(p => p.Groceries)
                .FirstOrDefaultAsync(r => r.Profiles.Any(p => p.Id == id))
            ?? throw new NotFoundError(nameof(RecipeProfile));
        var profile = recipe.Profiles.First(p => p.Id == id);

        var groceryItemIds = command.Groceries.Select(row => row.Id).Where(id => id != Guid.Empty).ToArray();
        if (await dbContext.Set<RecipeProfileGroceryItem>().AnyAsync(row => groceryItemIds.Contains(row.Id) && row.RecipeProfileId != id))
        {
            throw new ValidationException("Grocery item IDs must belong to the edited profile.");
        }

        profile.Name = command.Name;
        profile.Servings = command.Servings;
        UpdateGroceries(profile, command.Groceries);

        await dbContext.SaveChangesAsync();

        return profile.ToDto();
    }

    public async Task DeleteRecipeProfile(Guid id)
    {
        if (await dbContext.MealPlans
            .SelectMany(mealPlan => mealPlan.Entries.OfType<PlannedMeal>())
            .AnyAsync(meal => meal.RecipeProfileId == id))
        {
            throw new InvalidOperationError(
                ErrorCodes.RecipeProfileInUse,
                "A recipe profile used in a meal plan cannot be deleted.");
        }

        var recipe = await dbContext.Recipes
                .Include(r => r.Profiles)
                .FirstOrDefaultAsync(r => r.Profiles.Any(p => p.Id == id))
            ?? throw new NotFoundError(nameof(RecipeProfile));
        var profile = recipe.Profiles.First(p => p.Id == id);

        if (recipe.Profiles.Count <= 1)
        {
            throw new InvalidOperationError(
                ErrorCodes.RecipeMustKeepProfile,
                "A recipe must keep at least one profile.");
        }

        dbContext.Remove(profile);
        await dbContext.SaveChangesAsync();
    }

    private static void UpdateGroceries(RecipeProfile profile, ICollection<RecipeProfileGroceryItemInputDto> groceries)
    {
        var existingById = profile.Groceries.ToDictionary(item => item.Id);
        var submittedIds = groceries.Where(item => item.Id != Guid.Empty)
            .Select(item => item.Id)
            .ToHashSet();

        profile.Groceries.RemoveAll(item => !submittedIds.Contains(item.Id));

        foreach (var (dto, order) in groceries.Select((item, order) => (item, order)))
        {
            if (dto.Id != Guid.Empty && existingById.TryGetValue(dto.Id, out var item))
            {
                item.Name = dto.Name;
                item.Quantity = dto.Quantity;
                item.AtHome = dto.AtHome;
                item.Order = order;
            }
            else
            {
                profile.Groceries.Add(new RecipeProfileGroceryItem
                {
                    Id = dto.Id == Guid.Empty ? Guid.CreateVersion7() : dto.Id,
                    RecipeProfileId = profile.Id,
                    Name = dto.Name,
                    Quantity = dto.Quantity,
                    AtHome = dto.AtHome,
                    Order = order,
                });
            }
        }
    }
}
