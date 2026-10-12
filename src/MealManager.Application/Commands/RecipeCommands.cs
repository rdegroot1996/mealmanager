using MealManager.Application.Mapping;
using MealManager.Domain.Contracts;
using MealManager.Domain.Entities;
using MealManager.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace MealManager.Application.Commands;

public class RecipeCommands(
    ApplicationDbContext dbContext,
    IImageStorage imageStorage,
    ILogger<RecipeCommands> logger)
{
    public async Task<RecipeDto> CreateRecipe(CreateRecipeDto command)
    {
        var recipeId = Guid.CreateVersion7();
        var recipe = new Recipe
        {
            Id = recipeId,
            Name = command.Name,
            Notes = command.Notes,
            Category = command.Category,
            BaseServings = command.BaseServings,
            Tags = command.Tags
                .Distinct()
                .Select(t => new RecipeTag
                {
                    Id = Guid.CreateVersion7(),
                    RecipeId = recipeId,
                    Name = t,
                })
                .ToList(),
            Ingredients = command.Ingredients
                .Select((i, order) => new RecipeIngredient
                {
                    Id = Guid.CreateVersion7(),
                    RecipeId = recipeId,
                    Name = i.Name,
                    Quantity = i.Quantity,
                    Unit = i.Unit,
                    Order = order,
                })
                .ToList(),
            Steps = command.Steps
                .Select((s, order) => new RecipeStep
                {
                    Id = Guid.CreateVersion7(),
                    RecipeId = recipeId,
                    Description = s.Description,
                    Order = order,
                })
                .ToList(),
            Profiles =
            [
                new RecipeProfile
                {
                    Id = Guid.CreateVersion7(),
                    RecipeId = recipeId,
                    Name = "Default",
                    Servings = command.BaseServings,
                    Products = [],
                },
            ],
        };

        dbContext.Recipes.Add(recipe);
        await dbContext.SaveChangesAsync();

        return recipe.ToDto();
    }

    public async Task<RecipeDto> UpdateRecipe(Guid id, UpdateRecipeDto command)
    {
        var recipe = await dbContext.Recipes
                .Include(r => r.Tags)
                .Include(r => r.Ingredients)
                .Include(r => r.Steps)
                .Include(r => r.Images)
                .Include(r => r.Profiles)
                .FirstOrDefaultAsync(r => r.Id == id)
         ?? throw new NotFoundError(nameof(Recipe));

        var ingredientIds = command.Ingredients.Select(row => row.Id).Where(id => id != Guid.Empty).ToArray();
        var stepIds = command.Steps.Select(row => row.Id).Where(id => id != Guid.Empty).ToArray();
        if (await dbContext.Set<RecipeIngredient>().AnyAsync(row => ingredientIds.Contains(row.Id) && row.RecipeId != id) ||
            await dbContext.Set<RecipeStep>().AnyAsync(row => stepIds.Contains(row.Id) && row.RecipeId != id))
        {
            throw new ValidationException("Row IDs must belong to the edited recipe.");
        }

        recipe.Name = command.Name;
        recipe.Notes = command.Notes;
        recipe.Category = command.Category;
        recipe.BaseServings = command.BaseServings;
        UpdateTags(recipe, command.Tags);
        UpdateIngredients(recipe, command.Ingredients);
        UpdateSteps(recipe, command.Steps);
        await dbContext.SaveChangesAsync();

        return recipe.ToDto();
    }

    public async Task<RecipeSummaryDto> SetFavorite(Guid id, SetRecipeFavoriteDto command)
    {
        var recipe = await dbContext.Recipes
            .Include(item => item.Tags)
            .Include(item => item.Images)
            .SingleOrDefaultAsync(item => item.Id == id)
            ?? throw new NotFoundError(nameof(Recipe));

        recipe.IsFavorite = command.IsFavorite;
        await dbContext.SaveChangesAsync();
        return recipe.ToSummaryDto();
    }

    public async Task DeleteRecipe(Guid id)
    {
        if (await dbContext.Plannings
            .SelectMany(planning => planning.Entries.OfType<PlanningMeal>())
            .AnyAsync(meal => meal.RecipeId == id))
        {
            throw new InvalidOperationError(
                ErrorCodes.RecipeInUse,
                "A recipe used by planning cannot be deleted.");
        }

        var recipe = await dbContext.Recipes
                .Include(r => r.Images)
                .FirstOrDefaultAsync(r => r.Id == id)
         ?? throw new NotFoundError(nameof(Recipe));
        var imagePaths = recipe.Images.Select(image => image.RelativePath).ToArray();

        dbContext.Recipes.Remove(recipe);
        await dbContext.SaveChangesAsync();

        foreach (var imagePath in imagePaths)
        {
            try
            {
                await imageStorage.DeleteImage(imagePath, CancellationToken.None);
            }
            catch (Exception exception)
            {
                logger.LogWarning(exception, "Could not delete stored image {ImagePath}.", imagePath);
            }
        }
    }

    private static void UpdateTags(Recipe recipe, ICollection<string> tags)
    {
        recipe.Tags.RemoveAll(tag => !tags.Contains(tag.Name));

        foreach (var tag in tags.Where(tag => recipe.Tags.All(existing => existing.Name != tag)))
        {
            recipe.Tags.Add(new RecipeTag
            {
                Id = Guid.CreateVersion7(),
                RecipeId = recipe.Id,
                Name = tag,
            });
        }
    }

    private static void UpdateIngredients(Recipe recipe, ICollection<RecipeIngredientInputDto> ingredients)
    {
        var existingById = recipe.Ingredients.ToDictionary(ingredient => ingredient.Id);
        var submittedIds = ingredients.Where(ingredient => ingredient.Id != Guid.Empty)
            .Select(ingredient => ingredient.Id)
            .ToHashSet();

        recipe.Ingredients.RemoveAll(ingredient => !submittedIds.Contains(ingredient.Id));

        foreach (var (dto, order) in ingredients.Select((ingredient, order) => (ingredient, order)))
        {
            if (dto.Id != Guid.Empty && existingById.TryGetValue(dto.Id, out var ingredient))
            {
                ingredient.Name = dto.Name;
                ingredient.Quantity = dto.Quantity;
                ingredient.Unit = dto.Unit;
                ingredient.Order = order;
            }
            else
            {
                recipe.Ingredients.Add(new RecipeIngredient
                {
                    Id = dto.Id == Guid.Empty ? Guid.CreateVersion7() : dto.Id,
                    RecipeId = recipe.Id,
                    Name = dto.Name,
                    Quantity = dto.Quantity,
                    Unit = dto.Unit,
                    Order = order,
                });
            }
        }
    }

    private static void UpdateSteps(Recipe recipe, ICollection<RecipeStepInputDto> steps)
    {
        var existingById = recipe.Steps.ToDictionary(step => step.Id);
        var submittedIds = steps.Where(step => step.Id != Guid.Empty)
            .Select(step => step.Id)
            .ToHashSet();

        recipe.Steps.RemoveAll(step => !submittedIds.Contains(step.Id));

        foreach (var (dto, order) in steps.Select((step, order) => (step, order)))
        {
            if (dto.Id != Guid.Empty && existingById.TryGetValue(dto.Id, out var step))
            {
                step.Description = dto.Description;
                step.Order = order;
            }
            else
            {
                recipe.Steps.Add(new RecipeStep
                {
                    Id = dto.Id == Guid.Empty ? Guid.CreateVersion7() : dto.Id,
                    RecipeId = recipe.Id,
                    Description = dto.Description,
                    Order = order,
                });
            }
        }
    }
}
