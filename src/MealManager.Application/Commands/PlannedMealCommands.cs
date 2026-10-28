using MealManager.Application.Mapping;
using MealManager.Domain.Entities;
using MealManager.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace MealManager.Application.Commands;

public class PlannedMealCommands(ApplicationDbContext dbContext, PlanningCycleAccess cycleAccess)
{
    public async Task<PlannedEntryDto> AddPlannedMeal(AddPlannedMealDto command)
    {
        var mealPlan = await LoadMealPlan(command.MealPlanId);
        await cycleAccess.EnsureDateInCycle(mealPlan.PlanningCycleId, command.Date);
        var (recipe, profile) = await LoadRecipeAndProfile(command.RecipeId, command.RecipeProfileId);
        var meal = new PlannedMeal
        {
            Id = Guid.CreateVersion7(),
            MealPlanId = mealPlan.Id,
            RecipeId = command.RecipeId,
            RecipeProfileId = command.RecipeProfileId,
            Date = command.Date,
            SortOrder = NextSortOrder(mealPlan, command.Date),
        };
        mealPlan.Entries.Add(meal);
        await dbContext.SaveChangesAsync();
        return meal.ToDto(recipe, profile, false);
    }

    public async Task<PlannedEntryDto> PlanLeftovers(Guid id, PlanLeftoversDto command)
    {
        var mealPlan = await LoadMealPlanForEntry(id);
        var meal = mealPlan.Entries.OfType<PlannedMeal>().SingleOrDefault(entry => entry.Id == id)
            ?? throw new NotFoundError(nameof(PlannedMeal));
        await cycleAccess.EnsureLeftoverDate(mealPlan.PlanningCycleId, meal.Date, command.Date);
        if (mealPlan.Entries.OfType<PlannedLeftover>().Any(x => x.OriginalMealId == id && x.Date == command.Date))
            throw new InvalidOperationError(
                ErrorCodes.LeftoverAlreadyPlanned,
                "This leftover is already planned for the selected date.");
        var leftover = new PlannedLeftover
        {
            Id = Guid.CreateVersion7(),
            MealPlanId = mealPlan.Id,
            OriginalMealId = meal.Id,
            Date = command.Date,
            SortOrder = NextSortOrder(mealPlan, command.Date),
        };
        mealPlan.Entries.Add(leftover);
        await dbContext.SaveChangesAsync();
        var (recipe, profile) = await LoadRecipeAndProfile(meal);
        return leftover.ToDto(recipe, profile, await HasReviewedGroceries(meal.Id));
    }

    public async Task<PlannedEntryDto> MovePlannedEntry(Guid id, MovePlannedEntryDto command)
    {
        var mealPlan = await LoadMealPlanForEntry(id);
        var entry = mealPlan.Entries.Single(item => item.Id == id);
        await cycleAccess.EnsureDateInCycle(mealPlan.PlanningCycleId, command.TargetDate);
        PlannedMeal original;
        if (entry is PlannedMeal meal)
        {
            if (mealPlan.Entries.OfType<PlannedLeftover>().Any(x => x.OriginalMealId == id && command.TargetDate >= x.Date))
                throw new InvalidOperationError(
                    ErrorCodes.MealMustPrecedeLeftovers,
                    "A meal must remain before all of its planned leftovers.");
            original = meal;
        }
        else
        {
            var leftover = (PlannedLeftover)entry;
            original = mealPlan.Entries.OfType<PlannedMeal>().Single(meal => meal.Id == leftover.OriginalMealId);
            await cycleAccess.EnsureLeftoverDate(mealPlan.PlanningCycleId, original.Date, command.TargetDate);
        }
        var sourceDate = entry.Date;
        entry.Date = command.TargetDate;
        var targetEntries = GetDayEntries(mealPlan, command.TargetDate).Where(item => item.Id != entry.Id).ToList();
        targetEntries.Insert(Math.Clamp(command.TargetIndex ?? targetEntries.Count, 0, targetEntries.Count), entry);
        var orderedDays = new Dictionary<DateOnly, List<PlannedEntry>> { [command.TargetDate] = targetEntries };
        if (sourceDate != command.TargetDate) orderedDays[sourceDate] = GetDayEntries(mealPlan, sourceDate);
        await PersistOrder(orderedDays);
        var (recipe, profile) = await LoadRecipeAndProfile(original);
        return entry.ToDto(recipe, profile, await HasReviewedGroceries(original.Id));
    }

    public async Task<MealShoppingGroupDto> ReviewMealGroceries(Guid id, ReviewMealGroceriesDto command)
    {
        var mealPlan = await LoadMealPlanForEntry(id);
        var meal = mealPlan.Entries.OfType<PlannedMeal>().SingleOrDefault(entry => entry.Id == id)
            ?? throw new NotFoundError(nameof(PlannedMeal));
        var (recipe, profile) = await LoadRecipeAndProfile(meal);
        var sourceIds = command.Groceries
            .Where(item => item.RecipeProfileGroceryItemId.HasValue)
            .Select(item => item.RecipeProfileGroceryItemId!.Value)
            .ToArray();
        if (sourceIds.Length != sourceIds.Distinct().Count() ||
            sourceIds.Any(sourceId => profile.Groceries.All(item => item.Id != sourceId)))
        {
            throw new InvalidOperationError(
                ErrorCodes.InvalidProfileGroceries,
                "Profile grocery item identifiers must be unique and belong to the selected recipe profile.");
        }
        if (!await HasReviewedGroceries(id)) meal.GroceryReview = new MealGroceryReview { Id = Guid.CreateVersion7(), PlannedMealId = id };
        var shoppingList = await dbContext.ShoppingLists.Include(g => g.Items)
            .SingleAsync(g => g.PlanningCycleId == mealPlan.PlanningCycleId);
        dbContext.RemoveRange(shoppingList.Items.Where(g => g.PlannedMealId == id));
        var groceries = command.Groceries.Select((g, order) => new ShoppingListItem
        {
            Id = Guid.CreateVersion7(),
            ShoppingListId = shoppingList.Id,
            PlannedMealId = id,
            RecipeProfileGroceryItemId = g.RecipeProfileGroceryItemId,
            Name = g.Name,
            Quantity = g.Quantity,
            Order = order,
        }).ToList();
        shoppingList.Items.AddRange(groceries);
        await dbContext.SaveChangesAsync();
        return new MealShoppingGroupDto
        {
            Meal = meal.ToSummaryDto(recipe, profile),
            Items = groceries.ToDtos(),
        };
    }

    public async Task<PlannedEntryDto> UpdatePlannedMealProfile(Guid id, Guid profileId)
    {
        var mealPlan = await LoadMealPlanForEntry(id);
        var meal = mealPlan.Entries.OfType<PlannedMeal>().SingleOrDefault(entry => entry.Id == id)
            ?? throw new NotFoundError(nameof(PlannedMeal));
        var (recipe, profile) = await LoadRecipeAndProfile(meal.RecipeId, profileId);
        meal.RecipeProfileId = profileId;
        var list = await dbContext.ShoppingLists.Include(g => g.Items)
            .SingleAsync(g => g.PlanningCycleId == mealPlan.PlanningCycleId);
        dbContext.RemoveRange(list.Items.Where(g => g.PlannedMealId == id));
        var marker = await dbContext.Set<MealGroceryReview>().SingleOrDefaultAsync(x => x.PlannedMealId == id);
        if (marker is not null) dbContext.Remove(marker);
        await dbContext.SaveChangesAsync();
        return meal.ToDto(recipe, profile, false);
    }

    public async Task DeletePlannedMeal(Guid id)
    {
        var mealPlan = await LoadMealPlanForEntry(id);
        var entryToRemove = mealPlan.Entries.Single(entry => entry.Id == id);
        var list = await dbContext.ShoppingLists.Include(g => g.Items)
            .SingleAsync(g => g.PlanningCycleId == mealPlan.PlanningCycleId);
        if (entryToRemove is PlannedMeal)
            dbContext.RemoveRange(list.Items.Where(g => g.PlannedMealId == id));
        var removed = mealPlan.Entries.Where(entry => entry.Id == id ||
            entry is PlannedLeftover leftover && leftover.OriginalMealId == id).ToList();
        var dates = removed.Select(entry => entry.Date).Distinct().ToArray();
        dbContext.RemoveRange(removed);
        mealPlan.Entries.RemoveAll(removed.Contains);
        await PersistOrder(dates.ToDictionary(date => date, date => GetDayEntries(mealPlan, date)));
    }

    private async Task<MealPlan> LoadMealPlan(Guid id) =>
        await dbContext.MealPlans.Include(p => p.Entries).SingleOrDefaultAsync(p => p.Id == id)
        ?? throw new NotFoundError(nameof(MealPlan));

    private async Task<MealPlan> LoadMealPlanForEntry(Guid id) =>
        await dbContext.MealPlans.Include(p => p.Entries).SingleOrDefaultAsync(p => p.Entries.Any(e => e.Id == id))
        ?? throw new NotFoundError(nameof(PlannedEntry));

    private Task<(Recipe Recipe, RecipeProfile Profile)> LoadRecipeAndProfile(PlannedMeal meal) =>
        LoadRecipeAndProfile(meal.RecipeId, meal.RecipeProfileId);

    private async Task<(Recipe Recipe, RecipeProfile Profile)> LoadRecipeAndProfile(Guid recipeId, Guid profileId)
    {
        var recipe = await dbContext.Recipes.Include(r => r.Profiles).ThenInclude(p => p.Groceries)
            .Include(r => r.Tags).Include(r => r.Images)
            .SingleOrDefaultAsync(r => r.Id == recipeId) ?? throw new NotFoundError(nameof(Recipe));
        var profile = recipe.Profiles.SingleOrDefault(item => item.Id == profileId)
            ?? throw new NotFoundError(nameof(RecipeProfile));
        return (recipe, profile);
    }

    private Task<bool> HasReviewedGroceries(Guid id) => dbContext.Set<MealGroceryReview>().AnyAsync(x => x.PlannedMealId == id);
    private static int NextSortOrder(MealPlan p, DateOnly date) =>
        GetDayEntries(p, date).Select(e => e.SortOrder).DefaultIfEmpty(-1).Max() + 1;
    private static List<PlannedEntry> GetDayEntries(MealPlan p, DateOnly date) =>
        p.Entries.Where(e => e.Date == date).OrderBy(e => e.SortOrder).ThenBy(e => e.Id).ToList();

    private async Task PersistOrder(IReadOnlyDictionary<DateOnly, List<PlannedEntry>> orderedDays)
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
