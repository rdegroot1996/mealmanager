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
            Products = command.Products.Select((product, order) => new RecipeProfileProduct
            {
                Id = Guid.CreateVersion7(),
                RecipeProfileId = profileId,
                Name = product.Name,
                Quantity = product.Quantity,
                AtHome = product.AtHome,
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
                .ThenInclude(p => p.Products)
                .FirstOrDefaultAsync(r => r.Profiles.Any(p => p.Id == id))
            ?? throw new NotFoundError(nameof(RecipeProfile));
        var profile = recipe.Profiles.First(p => p.Id == id);

        var productIds = command.Products.Select(row => row.Id).Where(id => id != Guid.Empty).ToArray();
        if (await dbContext.Set<RecipeProfileProduct>().AnyAsync(row => productIds.Contains(row.Id) && row.RecipeProfileId != id))
        {
            throw new ValidationException("Product IDs must belong to the edited profile.");
        }

        profile.Name = command.Name;
        profile.Servings = command.Servings;
        UpdateProducts(profile, command.Products);

        await dbContext.SaveChangesAsync();

        return profile.ToDto();
    }

    public async Task DeleteRecipeProfile(Guid id)
    {
        if (await dbContext.Plannings
            .SelectMany(planning => planning.Entries.OfType<PlanningMeal>())
            .AnyAsync(meal => meal.RecipeProfileId == id))
        {
            throw new InvalidOperationError(
                ErrorCodes.RecipeProfileInUse,
                "A recipe profile used by planning cannot be deleted.");
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

    private static void UpdateProducts(RecipeProfile profile, ICollection<RecipeProfileProductInputDto> products)
    {
        var existingById = profile.Products.ToDictionary(product => product.Id);
        var submittedIds = products.Where(product => product.Id != Guid.Empty)
            .Select(product => product.Id)
            .ToHashSet();

        profile.Products.RemoveAll(product => !submittedIds.Contains(product.Id));

        foreach (var (dto, order) in products.Select((product, order) => (product, order)))
        {
            if (dto.Id != Guid.Empty && existingById.TryGetValue(dto.Id, out var product))
            {
                product.Name = dto.Name;
                product.Quantity = dto.Quantity;
                product.AtHome = dto.AtHome;
                product.Order = order;
            }
            else
            {
                profile.Products.Add(new RecipeProfileProduct
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
