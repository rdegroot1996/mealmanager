using MealManager.Common.Enums;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using MealManager.Application.Supermarkets;
using MealManager.Domain.Contracts;
using MealManager.Domain.Entities;
using MealManager.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace MealManager.Application.Queries;

public sealed class SupermarketQueries(ApplicationDbContext db, SupermarketProviders supermarkets)
{
    public async Task<IReadOnlyList<SupermarketConnectionDto>> Providers()
    {
        var result = new List<SupermarketConnectionDto>();
        foreach (var adapter in supermarkets.Providers)
        {
            var connection = await adapter.GetConnection(CancellationToken.None);
            result.Add(new SupermarketConnectionDto
            {
                Provider = adapter.Id,
                Name = adapter.Name,
                Status = connection.Status,
                AccountLabel = connection.AccountLabel,
            });
        }
        return result;
    }

    public async Task<IReadOnlyList<SupermarketProduct>> Search(SupermarketProvider provider, string query, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(query) || query.Length > 200) return [];
        try { return await supermarkets.Provider(provider).Search(query.Trim(), await supermarkets.Connection(provider, ct), ct); }
        catch (SupermarketException ex) { throw SupermarketProviders.Error(ex); }
    }

    public async Task<SupermarketReviewDto> Review(Guid cycleId, SupermarketProvider provider, CancellationToken ct)
    {
        try
        {
            var items = await Groceries(cycleId, ct);
            var connection = await supermarkets.Connection(provider, ct);
            var profileIds = items.Where(x => x.RecipeProfileGroceryItemId.HasValue).Select(x => x.RecipeProfileGroceryItemId!.Value).Distinct().ToArray();
            var mappings = await db.SupermarketProductMappings.AsNoTracking()
                .Where(x => x.Provider == provider && profileIds.Contains(x.RecipeProfileGroceryItemId)).ToDictionaryAsync(x => x.RecipeProfileGroceryItemId, ct);
            var cache = new Dictionary<string, SupermarketProduct>();
            var result = new List<SupermarketReviewItemDto>();
            var adapter = supermarkets.Provider(provider);
            foreach (var item in items)
            {
                SupermarketProduct? product = null;
                if (item.RecipeProfileGroceryItemId is Guid profileId && mappings.TryGetValue(profileId, out var mapping))
                {
                    if (!cache.TryGetValue(mapping.ProductId, out product))
                        cache[mapping.ProductId] = product = await adapter.GetProduct(mapping.ProductId, connection, ct);
                    if (product.Availability == ProductAvailability.Missing) product = product with { Name = mapping.ProductName, Pack = mapping.Pack };
                }
                result.Add(new SupermarketReviewItemDto
                {
                    ShoppingListItemId = item.Id,
                    RecipeProfileGroceryItemId = item.RecipeProfileGroceryItemId,
                    Name = item.Name,
                    Quantity = item.Quantity,
                    Checked = item.Checked,
                    Group = item.PlannedMeal?.Recipe.Name ?? "Other items",
                    Product = product,
                });
            }
            var unreviewed = await db.Set<PlannedMeal>().CountAsync(x => x.MealPlan.PlanningCycleId == cycleId && x.GroceryReview == null, ct);
            return new SupermarketReviewDto
            {
                Provider = provider,
                AccountId = connection.AccountId!,
                ConnectionGeneration = connection.Generation,
                Revision = Revision(items),
                Items = result,
                UnreviewedMeals = unreviewed,
            };
        }
        catch (SupermarketException ex) { throw SupermarketProviders.Error(ex); }
    }

    internal async Task<List<ShoppingListItem>> Groceries(Guid cycleId, CancellationToken ct)
    {
        if (!await db.PlanningCycles.AnyAsync(x => x.Id == cycleId, ct)) throw new NotFoundError("Planning cycle");
        return await db.Set<ShoppingListItem>().AsNoTracking().Include(x => x.PlannedMeal).ThenInclude(x => x!.Recipe)
            .Where(x => x.ShoppingList.PlanningCycleId == cycleId)
            .OrderBy(x => x.PlannedMealId == null)
            .ThenBy(x => x.PlannedMeal!.Date)
            .ThenBy(x => x.PlannedMealId)
            .ThenBy(x => x.Order)
            .ThenBy(x => x.Id)
            .ToListAsync(ct);
    }
    internal static string Revision(List<ShoppingListItem> items) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(items.Select(x => new { x.Id, x.Name, x.Quantity, x.Checked, x.RecipeProfileGroceryItemId })))));
}
