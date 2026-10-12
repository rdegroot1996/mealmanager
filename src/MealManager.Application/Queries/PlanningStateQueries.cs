using System.Security.Cryptography;
using System.Text.Json;
using MealManager.Domain.Entities;
using MealManager.Infrastructure.Database;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace MealManager.Application.Queries;

public sealed class PlanningStateQueries(
    ApplicationDbContext dbContext, PlanningCycleQueries cycleQueries, PlanningQueries planningQueries)
{
    // Returned even without a cycle, so a first-cycle proposal can have a concurrency precondition.
    public const string EmptyVersion = "none";

    public async Task<PlanningStateDto> GetActivePlanning()
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

    private async Task<PlanningStateDto> Read()
    {
        var cycleId = await dbContext.PlanningCycles.AsNoTracking().OrderByDescending(cycle => cycle.StartDate)
            .Select(cycle => (Guid?)cycle.Id).FirstOrDefaultAsync();
        if (!cycleId.HasValue) return new PlanningStateDto { PlanningVersion = EmptyVersion };
        var cycle = await cycleQueries.GetPlanningCycle(cycleId.Value);
        var planning = await planningQueries.GetCyclePlanning(cycle.Id);
        var profileIds = planning.Entries.Select(entry => entry.RecipeProfile.Id).Distinct().ToArray();
        var profiles = await dbContext.Set<RecipeProfile>().AsNoTracking().Where(profile => profileIds.Contains(profile.Id))
            .OrderBy(profile => profile.Id).Select(profile => new
            {
                profile.Id,
                profile.Name,
                profile.Servings,
                Products = profile.Products.OrderBy(product => product.Order).ThenBy(product => product.Id)
                    .Select(product => new { product.Id, product.Name, product.Quantity, product.AtHome, product.Order }).ToArray(),
            }).ToArrayAsync();
        var groceries = await dbContext.GroceryLists.AsNoTracking().Where(list => list.PlanningCycleId == cycle.Id)
            .SelectMany(list => list.Groceries).Where(item => item.PlanningMealId.HasValue)
            .OrderBy(item => item.Id).Select(item => new
            {
                item.Id,
                item.PlanningMealId,
                item.RecipeProfileProductId,
                item.Name,
                item.Quantity,
                item.Checked,
                item.Order,
            }).ToArrayAsync();
        var canonical = new
        {
            Cycle = cycle,
            planning.Id,
            Entries = planning.Entries.OrderBy(entry => entry.Date).ThenBy(entry => entry.SortOrder).ThenBy(entry => entry.Id),
            Notes = planning.Notes.OrderBy(note => note.Id),
            Profiles = profiles,
            Groceries = groceries,
        };
        return new PlanningStateDto
        {
            Cycle = cycle,
            Planning = planning,
            PlanningVersion = Convert.ToHexString(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(canonical))),
        };
    }
}
