using MealManager.Application.Mapping;
using MealManager.Domain.Contracts;
using MealManager.Domain.Entities;
using MealManager.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace MealManager.Application.Commands;

public class RecipeImageCommands(
    ApplicationDbContext dbContext,
    IImageStorage imageStorage,
    ILogger<RecipeImageCommands> logger)
{
    public async Task<RecipeImageDto> AddRecipeImage(
        Guid recipeId,
        Stream source,
        CancellationToken cancellationToken = default)
    {
        var recipe = await dbContext.Recipes
                .Include(r => r.Images)
                .FirstOrDefaultAsync(r => r.Id == recipeId, cancellationToken)
            ?? throw new NotFoundError(nameof(Recipe));

        var storedImage = await imageStorage.StoreImage(source, cancellationToken);
        var image = new RecipeImage
        {
            Id = Guid.CreateVersion7(),
            RecipeId = recipe.Id,
            RelativePath = storedImage.RelativePath,
            ContentType = storedImage.ContentType,
            Order = recipe.Images.Count == 0 ? 0 : recipe.Images.Max(existing => existing.Order) + 1,
        };

        recipe.Images.Add(image);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            await DeleteStoredImage(storedImage.RelativePath);
            throw;
        }

        return image.ToDto();
    }

    public async Task<ICollection<RecipeImageDto>> UpdateRecipeImageOrder(
        Guid recipeId,
        UpdateRecipeImageOrderDto command,
        CancellationToken cancellationToken = default)
    {
        var recipe = await dbContext.Recipes
                .Include(r => r.Images)
                .FirstOrDefaultAsync(r => r.Id == recipeId, cancellationToken)
            ?? throw new NotFoundError(nameof(Recipe));

        var submittedIds = command.ImageIds.ToHashSet();
        if (submittedIds.Count != command.ImageIds.Count ||
            submittedIds.Count != recipe.Images.Count ||
            recipe.Images.Any(image => !submittedIds.Contains(image.Id)))
        {
            throw new InvalidOperationError(
                ErrorCodes.InvalidRecipeImageOrder,
                "The image order must contain every recipe image exactly once.");
        }

        var imagesById = recipe.Images.ToDictionary(image => image.Id);
        foreach (var (imageId, order) in command.ImageIds.Select((imageId, order) => (imageId, order)))
        {
            imagesById[imageId].Order = order;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return recipe.Images.ToDtos();
    }

    public async Task DeleteRecipeImage(
        Guid recipeId,
        Guid imageId,
        CancellationToken cancellationToken = default)
    {
        var recipe = await dbContext.Recipes
                .Include(r => r.Images)
                .FirstOrDefaultAsync(r => r.Id == recipeId, cancellationToken)
            ?? throw new NotFoundError(nameof(Recipe));
        var image = recipe.Images.FirstOrDefault(existing => existing.Id == imageId)
            ?? throw new NotFoundError(nameof(RecipeImage));

        recipe.Images.Remove(image);
        foreach (var remainingImage in recipe.Images.OrderBy(existing => existing.Order).Select((image, order) => new { image, order }))
        {
            remainingImage.image.Order = remainingImage.order;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await DeleteStoredImage(image.RelativePath);
    }

    private async Task DeleteStoredImage(string relativePath)
    {
        try
        {
            await imageStorage.DeleteImage(relativePath, CancellationToken.None);
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Could not delete stored image {ImagePath}.", relativePath);
        }
    }
}
