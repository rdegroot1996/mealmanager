using System.Security.Cryptography;
using System.Text.Json;
using MealManager.Domain.Entities;
using MealManager.Infrastructure.Database;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace MealManager.Application.Queries;

public sealed class MealPlanStateQueries(
    ApplicationDbContext dbContext, PlanningCycleQueries cycleQueries, MealPlanQueries mealPlanQueries)
{
    // Returned even without a cycle, so a first-cycle proposal can have a concurrency precondition.
    public const string EmptyVersion = "none";

    public async Task<MealPlanStateDto> GetActiveMealPlan()
    {
        if (dbContext.Database.CurrentTransaction is not null) return await Read();
        await dbContext.Database.OpenConnectionAsync();
        try
        {
            // Keep a consistent snapshot without reserving SQLite's writer slot.
            var connection = (SqliteConnection)dbContext.Database.GetDbConnection();
            await using var sqliteTransaction = connection.BeginTransaction(deferred: true);
            await using var transaction = await dbContext.Database.UseTransactionAsync(sqliteTransaction);
            var result = await Read();
            await sqliteTransaction.CommitAsync();
            return result;
        }
        finally
        {
            await dbContext.Database.CloseConnectionAsync();
        }
    }

    private async Task<MealPlanStateDto> Read()
    {
        var cycleId = await dbContext.PlanningCycles.AsNoTracking().OrderByDescending(cycle => cycle.StartDate)
            .Select(cycle => (Guid?)cycle.Id).FirstOrDefaultAsync();
        if (!cycleId.HasValue) return new MealPlanStateDto { MealPlanVersion = EmptyVersion };
        var cycle = await cycleQueries.GetPlanningCycle(cycleId.Value);
        var mealPlan = await mealPlanQueries.GetCycleMealPlan(cycle.Id);
        var profileIds = mealPlan.Entries.Select(entry => entry.RecipeProfile.Id).Distinct().ToArray();
        var profiles = await dbContext.Set<RecipeProfile>().AsNoTracking().Where(profile => profileIds.Contains(profile.Id))
            .OrderBy(profile => profile.Id).Select(profile => new
            {
                profile.Id,
                profile.Name,
                profile.Servings,
                Groceries = profile.Groceries.OrderBy(item => item.Order).ThenBy(item => item.Id)
                    .Select(item => new { item.Id, item.Name, item.Quantity, item.AtHome, item.Order }).ToArray(),
            }).ToArrayAsync();
        var groceries = await dbContext.ShoppingLists.AsNoTracking().Where(list => list.PlanningCycleId == cycle.Id)
            .SelectMany(list => list.Items).Where(item => item.PlannedMealId.HasValue)
            .OrderBy(item => item.Id).Select(item => new
            {
                item.Id,
                item.PlannedMealId,
                item.RecipeProfileGroceryItemId,
                item.Name,
                item.Quantity,
                item.Checked,
                item.Order,
            }).ToArrayAsync();
        var canonical = new
        {
            Cycle = cycle,
            mealPlan.Id,
            Entries = mealPlan.Entries.OrderBy(entry => entry.Date).ThenBy(entry => entry.SortOrder).ThenBy(entry => entry.Id),
            Notes = mealPlan.Notes.OrderBy(note => note.Id),
            Profiles = profiles,
            Groceries = groceries,
        };
        return new MealPlanStateDto
        {
            Cycle = cycle,
            MealPlan = mealPlan,
            MealPlanVersion = Convert.ToHexString(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(canonical))),
        };
    }
}
