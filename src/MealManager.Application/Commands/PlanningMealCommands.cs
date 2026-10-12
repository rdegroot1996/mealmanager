using MealManager.Application.Mapping;
using MealManager.Domain.Entities;
using MealManager.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace MealManager.Application.Commands;

public class PlanningMealCommands(ApplicationDbContext dbContext, PlanningCycleAccess cycleAccess)
{
    public async Task<PlanningEntryDto> AddPlanningMeal(AddPlanningMealDto command)
    {
        var planning = await LoadPlanning(command.PlanningId);
        await cycleAccess.EnsureDateInCycle(planning.PlanningCycleId, command.Date);
        var (recipe, profile) = await LoadRecipeAndProfile(command.RecipeId, command.RecipeProfileId);
        var meal = new PlanningMeal
        {
            Id = Guid.CreateVersion7(),
            PlanningId = planning.Id,
            RecipeId = command.RecipeId,
            RecipeProfileId = command.RecipeProfileId,
            Date = command.Date,
            SortOrder = NextSortOrder(planning, command.Date),
        };
        planning.Entries.Add(meal);
        await dbContext.SaveChangesAsync();
        return meal.ToDto(recipe, profile, false);
    }

    public async Task<PlanningEntryDto> PlanLeftovers(Guid id, PlanLeftoversDto command)
    {
        var planning = await LoadPlanningForEntry(id);
        var meal = planning.Entries.OfType<PlanningMeal>().SingleOrDefault(entry => entry.Id == id)
            ?? throw new NotFoundError(nameof(PlanningMeal));
        await cycleAccess.EnsureLeftoverDate(planning.PlanningCycleId, meal.Date, command.Date);
        if (planning.Entries.OfType<PlanningLeftover>().Any(x => x.OriginalMealId == id && x.Date == command.Date))
            throw new InvalidOperationError(
                ErrorCodes.LeftoverAlreadyPlanned,
                "This leftover is already planned for the selected date.");
        var leftover = new PlanningLeftover
        {
            Id = Guid.CreateVersion7(),
            PlanningId = planning.Id,
            OriginalMealId = meal.Id,
            Date = command.Date,
            SortOrder = NextSortOrder(planning, command.Date),
        };
        planning.Entries.Add(leftover);
        await dbContext.SaveChangesAsync();
        var (recipe, profile) = await LoadRecipeAndProfile(meal);
        return leftover.ToDto(recipe, profile, await HasGroceries(meal.Id));
    }

    public async Task<PlanningEntryDto> MovePlanningEntry(Guid id, MovePlanningEntryDto command)
    {
        var planning = await LoadPlanningForEntry(id);
        var entry = planning.Entries.Single(item => item.Id == id);
        await cycleAccess.EnsureDateInCycle(planning.PlanningCycleId, command.TargetDate);
        PlanningMeal original;
        if (entry is PlanningMeal meal)
        {
            if (planning.Entries.OfType<PlanningLeftover>().Any(x => x.OriginalMealId == id && command.TargetDate >= x.Date))
                throw new InvalidOperationError(
                    ErrorCodes.MealMustPrecedeLeftovers,
                    "A meal must remain before all of its planned leftovers.");
            original = meal;
        }
        else
        {
            var leftover = (PlanningLeftover)entry;
            original = planning.Entries.OfType<PlanningMeal>().Single(meal => meal.Id == leftover.OriginalMealId);
            await cycleAccess.EnsureLeftoverDate(planning.PlanningCycleId, original.Date, command.TargetDate);
        }
        var sourceDate = entry.Date;
        entry.Date = command.TargetDate;
        var targetEntries = GetDayEntries(planning, command.TargetDate).Where(item => item.Id != entry.Id).ToList();
        targetEntries.Insert(Math.Clamp(command.TargetIndex ?? targetEntries.Count, 0, targetEntries.Count), entry);
        var orderedDays = new Dictionary<DateOnly, List<PlanningEntry>> { [command.TargetDate] = targetEntries };
        if (sourceDate != command.TargetDate) orderedDays[sourceDate] = GetDayEntries(planning, sourceDate);
        await PersistOrder(orderedDays);
        var (recipe, profile) = await LoadRecipeAndProfile(original);
        return entry.ToDto(recipe, profile, await HasGroceries(original.Id));
    }

    public async Task<PlanningMealGroceriesDto> AddMealGroceries(Guid id, AddMealGroceriesDto command)
    {
        var planning = await LoadPlanningForEntry(id);
        await cycleAccess.EnsureEditable(planning.PlanningCycleId);
        var meal = planning.Entries.OfType<PlanningMeal>().SingleOrDefault(entry => entry.Id == id)
            ?? throw new NotFoundError(nameof(PlanningMeal));
        var (recipe, profile) = await LoadRecipeAndProfile(meal);
        var sourceIds = command.Groceries
            .Where(item => item.RecipeProfileProductId.HasValue)
            .Select(item => item.RecipeProfileProductId!.Value)
            .ToArray();
        if (sourceIds.Length != sourceIds.Distinct().Count() ||
            sourceIds.Any(sourceId => profile.Products.All(product => product.Id != sourceId)))
        {
            throw new InvalidOperationError(
                ErrorCodes.InvalidGroceryProducts,
                "Grocery product identifiers must be unique and belong to the selected recipe profile.");
        }
        if (!await HasGroceries(id)) meal.Groceries = new MealGroceries { Id = Guid.CreateVersion7(), PlanningMealId = id };
        var groceryList = await dbContext.GroceryLists.Include(g => g.Groceries)
            .SingleAsync(g => g.PlanningCycleId == planning.PlanningCycleId);
        dbContext.RemoveRange(groceryList.Groceries.Where(g => g.PlanningMealId == id));
        var groceries = command.Groceries.Select((g, order) => new GroceryItem
        {
            Id = Guid.CreateVersion7(),
            GroceryListId = groceryList.Id,
            PlanningMealId = id,
            RecipeProfileProductId = g.RecipeProfileProductId,
            Name = g.Name,
            Quantity = g.Quantity,
            Order = order,
        }).ToList();
        groceryList.Groceries.AddRange(groceries);
        await dbContext.SaveChangesAsync();
        return new PlanningMealGroceriesDto
        {
            PlanningMeal = meal.ToSummaryDto(recipe, profile),
            Groceries = groceries.ToDtos(),
        };
    }

    public async Task<PlanningEntryDto> UpdatePlanningMealProfile(Guid id, Guid profileId)
    {
        var planning = await LoadPlanningForEntry(id);
        await cycleAccess.EnsureEditable(planning.PlanningCycleId);
        var meal = planning.Entries.OfType<PlanningMeal>().SingleOrDefault(entry => entry.Id == id)
            ?? throw new NotFoundError(nameof(PlanningMeal));
        var (recipe, profile) = await LoadRecipeAndProfile(meal.RecipeId, profileId);
        meal.RecipeProfileId = profileId;
        var list = await dbContext.GroceryLists.Include(g => g.Groceries)
            .SingleAsync(g => g.PlanningCycleId == planning.PlanningCycleId);
        dbContext.RemoveRange(list.Groceries.Where(g => g.PlanningMealId == id));
        var marker = await dbContext.Set<MealGroceries>().SingleOrDefaultAsync(x => x.PlanningMealId == id);
        if (marker is not null) dbContext.Remove(marker);
        await dbContext.SaveChangesAsync();
        return meal.ToDto(recipe, profile, false);
    }

    public async Task DeletePlanningMeal(Guid id)
    {
        var planning = await LoadPlanningForEntry(id);
        await cycleAccess.EnsureEditable(planning.PlanningCycleId);
        var entryToRemove = planning.Entries.Single(entry => entry.Id == id);
        var list = await dbContext.GroceryLists.Include(g => g.Groceries)
            .SingleAsync(g => g.PlanningCycleId == planning.PlanningCycleId);
        if (entryToRemove is PlanningMeal)
            dbContext.RemoveRange(list.Groceries.Where(g => g.PlanningMealId == id));
        var removed = planning.Entries.Where(entry => entry.Id == id ||
            entry is PlanningLeftover leftover && leftover.OriginalMealId == id).ToList();
        var dates = removed.Select(entry => entry.Date).Distinct().ToArray();
        dbContext.RemoveRange(removed);
        planning.Entries.RemoveAll(removed.Contains);
        await PersistOrder(dates.ToDictionary(date => date, date => GetDayEntries(planning, date)));
    }

    private async Task<Planning> LoadPlanning(Guid id) =>
        await dbContext.Plannings.Include(p => p.Entries).SingleOrDefaultAsync(p => p.Id == id)
        ?? throw new NotFoundError(nameof(Planning));

    private async Task<Planning> LoadPlanningForEntry(Guid id) =>
        await dbContext.Plannings.Include(p => p.Entries).SingleOrDefaultAsync(p => p.Entries.Any(e => e.Id == id))
        ?? throw new NotFoundError(nameof(PlanningEntry));

    private Task<(Recipe Recipe, RecipeProfile Profile)> LoadRecipeAndProfile(PlanningMeal meal) =>
        LoadRecipeAndProfile(meal.RecipeId, meal.RecipeProfileId);

    private async Task<(Recipe Recipe, RecipeProfile Profile)> LoadRecipeAndProfile(Guid recipeId, Guid profileId)
    {
        var recipe = await dbContext.Recipes.Include(r => r.Profiles).ThenInclude(p => p.Products)
            .Include(r => r.Tags).Include(r => r.Images)
            .SingleOrDefaultAsync(r => r.Id == recipeId) ?? throw new NotFoundError(nameof(Recipe));
        var profile = recipe.Profiles.SingleOrDefault(item => item.Id == profileId)
            ?? throw new NotFoundError(nameof(RecipeProfile));
        return (recipe, profile);
    }

    private Task<bool> HasGroceries(Guid id) => dbContext.Set<MealGroceries>().AnyAsync(x => x.PlanningMealId == id);
    private static int NextSortOrder(Planning p, DateOnly date) =>
        GetDayEntries(p, date).Select(e => e.SortOrder).DefaultIfEmpty(-1).Max() + 1;
    private static List<PlanningEntry> GetDayEntries(Planning p, DateOnly date) =>
        p.Entries.Where(e => e.Date == date).OrderBy(e => e.SortOrder).ThenBy(e => e.Id).ToList();

    private async Task PersistOrder(IReadOnlyDictionary<DateOnly, List<PlanningEntry>> orderedDays)
    {
        await using var transaction = await dbContext.Database.BeginTransactionAsync();
        var temporaryOrder = int.MinValue;
        foreach (var entry in orderedDays.Values.SelectMany(entries => entries).DistinctBy(entry => entry.Id))
            entry.SortOrder = temporaryOrder++;
        await dbContext.SaveChangesAsync();
        foreach (var entries in orderedDays.Values)
            foreach (var (entry, index) in entries.Select((entry, index) => (entry, index))) entry.SortOrder = index;
        await dbContext.SaveChangesAsync();
        await transaction.CommitAsync();
    }
}
