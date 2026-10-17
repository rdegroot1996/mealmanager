using MealManager.Common.Enums;
using MealManager.Domain.Entities;
using MealManager.Infrastructure.Database;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace MealManager.Application.Commands;

public sealed class MealPlanReplacementCommands(
    ApplicationDbContext dbContext,
    MealPlanStateQueries stateQueries,
    PlanningCycleCommands cycleCommands,
    PlanningCycleAccess cycleAccess,
    IValidator<ApplyMealPlanDto> applyValidator,
    IValidator<CreateCycleMealPlanDto> createValidator)
{
    public async Task<MealPlanStateDto> Apply(ApplyMealPlanDto command)
    {
        await applyValidator.ValidateAndThrowAsync(command);
        return await InTransaction(async () =>
        {
            await cycleAccess.EnsureEditable(command.CycleId);
            await CheckVersion(command.ExpectedMealPlanVersion);
            var cycle = await dbContext.PlanningCycles.SingleAsync(item => item.Id == command.CycleId);
            var mealPlan = await dbContext.MealPlans.Include(item => item.Entries).Include(item => item.Notes)
                .SingleAsync(item => item.PlanningCycleId == cycle.Id);
            var createdIds = await Replace(cycle, mealPlan, command.Entries, command.Notes);
            return (await stateQueries.GetActiveMealPlan()) with { CreatedIds = createdIds };
        });
    }

    public async Task<MealPlanStateDto> Create(CreateCycleMealPlanDto command)
    {
        await createValidator.ValidateAndThrowAsync(command);
        return await InTransaction(async () =>
        {
            if (command.ExpectedMealPlanVersion is not null) await CheckVersion(command.ExpectedMealPlanVersion);
            var (cycle, mealPlan) = await cycleCommands.AddCycle(new CreatePlanningCycleDto
            {
                StartDate = command.StartDate,
                EndDate = command.EndDate,
            });
            var createdIds = await Replace(cycle, mealPlan, command.Entries ?? [], command.Notes ?? []);
            return (await stateQueries.GetActiveMealPlan()) with { CreatedIds = createdIds };
        });
    }

    private async Task CheckVersion(string expected)
    {
        var state = await stateQueries.GetActiveMealPlan();
        if (!string.Equals(state.MealPlanVersion, expected, StringComparison.Ordinal)) throw Changed();
    }

    private async Task<MealPlanStateDto> InTransaction(Func<Task<MealPlanStateDto>> action)
    {
        try
        {
            // SQLite's default transaction is immediate: acquire the write reservation before reading
            // the precondition, so a competing writer cannot change data between check and commit.
            await using var transaction = await dbContext.Database.BeginTransactionAsync();
            var result = await action();
            await transaction.CommitAsync();
            return result;
        }
        catch (SqliteException exception) when (exception.SqliteErrorCode is 5 or 6)
        {
            throw Changed();
        }
        catch (DbUpdateException exception) when (exception.InnerException is SqliteException { SqliteErrorCode: 5 or 6 })
        {
            throw Changed();
        }
    }

    private static InvalidOperationError Changed() =>
        new(ErrorCodes.MealPlanChanged, "The meal plan changed or is being edited. Read active meal plan again before submitting a revised plan.");

    private static void Require(bool condition, string message)
    {
        if (!condition) throw new InvalidOperationError(ErrorCodes.InvalidMealPlan, message);
    }

    private async Task<IReadOnlyDictionary<string, Guid>> Replace(
        PlanningCycle cycle, MealPlan mealPlan, PlannedEntryInputDto[] entries, PlanningDayNoteInputDto[] notes)
    {
        var oldEntries = mealPlan.Entries.ToDictionary(entry => entry.Id);
        var oldNotes = mealPlan.Notes.ToDictionary(note => note.Id);
        var submittedIds = entries.Where(entry => entry.Id.HasValue).Select(entry => entry.Id!.Value).ToArray();
        var noteIds = notes.Where(note => note.Id.HasValue).Select(note => note.Id!.Value).ToArray();
        Require(submittedIds.Distinct().Count() == submittedIds.Length && submittedIds.All(oldEntries.ContainsKey),
            "Entry identifiers must be unique and belong to this meal plan.");
        Require(noteIds.Distinct().Count() == noteIds.Length && noteIds.All(oldNotes.ContainsKey),
            "Note identifiers must be unique and belong to this meal plan.");
        var keys = entries.Where(entry => !entry.Id.HasValue).Select(entry => entry.ClientKey!)
            .Concat(notes.Where(note => !note.Id.HasValue).Select(note => note.ClientKey!)).ToArray();
        Require(keys.Distinct(StringComparer.Ordinal).Count() == keys.Length, "New record client keys must be unique.");
        Require(notes.Select(note => note.Date).Distinct().Count() == notes.Length, "A day can have only one note.");
        if (entries.Select(entry => entry.Date).Concat(notes.Select(note => note.Date))
            .Any(date => date < cycle.StartDate || date > cycle.EndDate))
            throw new InvalidOperationError(ErrorCodes.DateOutsideCycle, "The date must be inside the planning cycle.");

        var createdIds = keys.ToDictionary(key => key, _ => Guid.CreateVersion7(), StringComparer.Ordinal);
        var resolved = entries.Select(entry => new ResolvedPlannedEntry(entry, entry.Id ?? createdIds[entry.ClientKey!])).ToArray();
        var originals = resolved.Where(entry => entry.Input.Kind == PlannedEntryKind.Meal).ToDictionary(entry => entry.Id);
        var profileIds = originals.Values.Select(entry => entry.Input.ProfileId!.Value).Distinct().ToArray();
        var profiles = await dbContext.Set<RecipeProfile>().Where(profile => profileIds.Contains(profile.Id))
            .Select(profile => new { profile.Id, profile.RecipeId }).ToDictionaryAsync(profile => profile.Id);
        foreach (var entry in resolved)
        {
            var input = entry.Input;
            if (input.Id.HasValue)
            {
                var old = oldEntries[entry.Id];
                Require((old is PlannedMeal) == (input.Kind == PlannedEntryKind.Meal), "An existing entry cannot change kind.");
                if (old is PlannedMeal meal)
                    Require(meal.RecipeId == input.RecipeId, "Replace a recipe by omitting the old meal and adding a new meal with a client key.");
            }
            if (input.Kind == PlannedEntryKind.Meal)
            {
                Require(profiles.TryGetValue(input.ProfileId!.Value, out var profile) && profile.RecipeId == input.RecipeId,
                    "Every meal profile must exist and belong to the selected recipe.");
                continue;
            }
            var originalId = input.OriginalMealId ?? createdIds.GetValueOrDefault(input.OriginalMealKey!);
            Require(originals.ContainsKey(originalId), "Every leftover must refer to an original meal retained in this plan.");
            var original = originals[originalId];
            if (input.Date <= original.Input.Date)
                throw new InvalidOperationError(ErrorCodes.LeftoverMustFollowOriginal, "A leftover must be planned after its original meal.");
            entry.OriginalMealId = originalId;
        }
        Require(resolved.Where(entry => entry.Input.Kind == PlannedEntryKind.Leftover)
            .Select(entry => (entry.OriginalMealId, entry.Input.Date)).Distinct().Count() ==
            resolved.Count(entry => entry.Input.Kind == PlannedEntryKind.Leftover),
            "An original meal can have only one leftover entry per day.");

        // All validation completes before tracked data is changed.
        var removedOrChangedMeals = oldEntries.Values.OfType<PlannedMeal>().Where(meal =>
            !originals.TryGetValue(meal.Id, out var replacement) || replacement.Input.ProfileId != meal.RecipeProfileId)
            .Select(meal => meal.Id).ToArray();
        dbContext.RemoveRange(await dbContext.Set<ShoppingListItem>()
            .Where(item => item.PlannedMealId.HasValue && removedOrChangedMeals.Contains(item.PlannedMealId.Value)).ToArrayAsync());
        dbContext.RemoveRange(await dbContext.Set<MealGroceryReview>()
            .Where(marker => removedOrChangedMeals.Contains(marker.PlannedMealId)).ToArrayAsync());
        // Rebuild derived leftovers and notes using retained IDs to allow swaps under their unique date indexes.
        var oldLeftovers = oldEntries.Values.OfType<PlannedLeftover>().ToArray();
        dbContext.RemoveRange(oldLeftovers);
        dbContext.RemoveRange(oldEntries.Values.OfType<PlannedMeal>().Where(meal => !originals.ContainsKey(meal.Id)));
        dbContext.RemoveRange(oldNotes.Values);
        mealPlan.Entries.RemoveAll(entry => entry is PlannedLeftover || !originals.ContainsKey(entry.Id));
        mealPlan.Notes.Clear();
        var temporaryOrder = int.MinValue;
        foreach (var meal in mealPlan.Entries)
        {
            meal.SortOrder = temporaryOrder++;
        }
        await dbContext.SaveChangesAsync();

        var persisted = new Dictionary<Guid, PlannedEntry>();
        foreach (var original in originals.Values)
        {
            var input = original.Input;
            var meal = oldEntries.GetValueOrDefault(original.Id) as PlannedMeal;
            if (meal is null)
            {
                meal = new PlannedMeal
                {
                    Id = original.Id,
                    MealPlanId = mealPlan.Id,
                    RecipeId = input.RecipeId!.Value,
                    RecipeProfileId = input.ProfileId!.Value,
                    Date = input.Date,
                };
                mealPlan.Entries.Add(meal);
            }
            meal.Date = input.Date;
            meal.RecipeProfileId = input.ProfileId!.Value;
            persisted.Add(meal.Id, meal);
        }
        foreach (var leftover in resolved.Where(entry => entry.Input.Kind == PlannedEntryKind.Leftover))
        {
            var entry = new PlannedLeftover
            {
                Id = leftover.Id,
                MealPlanId = mealPlan.Id,
                Date = leftover.Input.Date,
                OriginalMealId = leftover.OriginalMealId!.Value,
            };
            mealPlan.Entries.Add(entry);
            persisted.Add(entry.Id, entry);
        }
        foreach (var day in resolved.GroupBy(entry => entry.Input.Date))
        {
            foreach (var (entry, index) in day.Select((entry, index) => (entry, index)))
            {
                persisted[entry.Id].SortOrder = index;
            }
        }
        foreach (var input in notes)
            mealPlan.Notes.Add(new PlanningDayNote
            {
                Id = input.Id ?? createdIds[input.ClientKey!],
                MealPlanId = mealPlan.Id,
                Date = input.Date,
                Text = input.Text,
            });
        await dbContext.SaveChangesAsync();
        return createdIds;
    }
}
