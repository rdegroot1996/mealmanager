using MealManager.Domain.Contracts;
using MealManager.Domain.Entities;
using MealManager.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace MealManager.Application.Queries;

public class RecipeImageQueries(ApplicationDbContext dbContext, IImageStorage imageStorage)
{
    public async Task<StoredRecipeImage> GetRecipeImage(
        Guid recipeId,
        Guid imageId,
        CancellationToken cancellationToken = default)
    {
        var image = await dbContext.Recipes
                .Where(recipe => recipe.Id == recipeId)
                .SelectMany(recipe => recipe.Images)
                .FirstOrDefaultAsync(recipeImage => recipeImage.Id == imageId, cancellationToken)
            ?? throw new NotFoundError(nameof(RecipeImage));

        var stream = await imageStorage.OpenRead(image.RelativePath, cancellationToken)
            ?? throw new NotFoundError(nameof(RecipeImage));

        return new StoredRecipeImage(stream, image.ContentType);
    }
}
