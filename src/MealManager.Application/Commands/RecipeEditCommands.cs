using MealManager.Application.Mapping;
using MealManager.Infrastructure.Database;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace MealManager.Application.Commands;

public sealed class RecipeEditCommands(
    ApplicationDbContext dbContext, RecipeQueries recipeQueries, RecipeProfileQueries profileQueries,
    RecipeCommands recipeCommands, RecipeProfileCommands profileCommands,
    IValidator<UpdateRecipeDto> recipeValidator, IValidator<UpdateRecipeProfileDto> profileValidator)
{
    public Task<RecipeStateDto> PatchRecipe(PatchRecipeDto patch) => InTransaction(async () =>
    {
        if (string.IsNullOrWhiteSpace(patch.ExpectedRecipeVersion))
        {
            throw new ValidationException("Expected recipe version is required.");
        }
        if (patch.Name is null && patch.Category is null && patch.BaseServings is null &&
            patch.Tags is null && patch.Ingredients is null && patch.Steps is null && patch.Notes is null)
        {
            throw new ValidationException("Supply at least one field to update.");
        }
        var current = await recipeQueries.GetRecipe(patch.RecipeId);
        if (current.ToState().RecipeVersion != patch.ExpectedRecipeVersion) throw Changed();
        ValidateRows(patch.Ingredients?.Select(row => row.Id), current.Ingredients.Select(row => row.Id));
        ValidateRows(patch.Steps?.Select(row => row.Id), current.Steps.Select(row => row.Id));
        var command = new UpdateRecipeDto
        {
            Name = patch.Name ?? current.Name,
            Notes = patch.Notes ?? current.Notes,
            Category = patch.Category ?? current.Category,
            BaseServings = patch.BaseServings ?? current.BaseServings,
            Tags = patch.Tags ?? current.Tags.Select(tag => tag.Name).ToArray(),
            Ingredients = patch.Ingredients ?? current.Ingredients.Select(row => row.ToInput()).ToArray(),
            Steps = patch.Steps ?? current.Steps.Select(row => row.ToInput()).ToArray(),
        };
        await recipeValidator.ValidateAndThrowAsync(command);
        return (await recipeCommands.UpdateRecipe(patch.RecipeId, command)).ToState();
    });

    public Task<RecipeProfileStateDto> PatchProfile(PatchRecipeProfileDto patch) => InTransaction(async () =>
    {
        if (string.IsNullOrWhiteSpace(patch.ExpectedProfileVersion))
        {
            throw new ValidationException("Expected profile version is required.");
        }
        if (patch.Name is null && patch.Servings is null && patch.Groceries is null)
        {
            throw new ValidationException("Supply at least one field to update.");
        }
        var current = await profileQueries.GetRecipeProfile(patch.ProfileId);
        if (current.ToState().ProfileVersion != patch.ExpectedProfileVersion) throw Changed();
        ValidateRows(patch.Groceries?.Select(row => row.Id), current.Groceries.Select(row => row.Id));
        var command = new UpdateRecipeProfileDto
        {
            Name = patch.Name ?? current.Name,
            Servings = patch.Servings ?? current.Servings,
            Groceries = patch.Groceries ?? current.Groceries.Select(row => row.ToInput()).ToArray(),
        };
        await profileValidator.ValidateAndThrowAsync(command);
        return (await profileCommands.UpdateRecipeProfile(patch.ProfileId, command)).ToState();
    });

    private static void ValidateRows(IEnumerable<Guid>? supplied, IEnumerable<Guid> existing)
    {
        if (supplied is null) return;
        var ids = supplied.Where(id => id != Guid.Empty).ToArray();
        var known = existing.ToHashSet();
        if (ids.Distinct().Count() != ids.Length || ids.Any(id => !known.Contains(id)))
            throw new ValidationException("Retained row IDs must be unique and belong to the edited recipe or profile. Omit IDs for new rows.");
    }

    private async Task<T> InTransaction<T>(Func<Task<T>> action)
    {
        try
        {
            await using var transaction = await dbContext.Database.BeginTransactionAsync();
            var result = await action();
            await transaction.CommitAsync();
            return result;
        }
        catch (SqliteException error) when (error.SqliteErrorCode is 5 or 6)
        {
            throw Changed();
        }
        catch (DbUpdateException error) when (error.InnerException is SqliteException { SqliteErrorCode: 5 or 6 })
        {
            throw Changed();
        }
    }

    private static InvalidOperationError Changed() => new(ErrorCodes.RecipeChanged,
        "Recipe or profile changed or is being edited. Read it again and reconcile before submitting.");
}
